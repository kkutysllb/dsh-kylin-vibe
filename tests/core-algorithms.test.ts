import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { fingerprintOf, recomputeCommunities, runLpa, type LpaEdge } from '../src/core/lpa.ts'
import { runPpr, type PprEdge } from '../src/core/ppr.ts'
import { searchGlobal, searchLocal, searchTraversal } from '../src/core/search.ts'
import { GraphRagError } from '../src/core/types.ts'
import { SqliteGraphStore, type ChunkInput, type ExtractionDelta } from '../src/core/graphstore.ts'
import { computeMentions } from '../src/core/extractor.ts'

const chain = (pairs: readonly (readonly [number, number])[]): LpaEdge[] =>
  pairs.map(([a, b]) => ({ src: a, dst: b, weight: 1 }))

// ── LPA ──────────────────────────────────────────────────────────────────────

describe('runLpa', () => {

  test('双簇图被正确划分，且结果确定', () => {
    const edges: LpaEdge[] = [
      ...chain([[1, 2], [2, 3], [1, 3], [4, 5], [5, 6], [4, 6]]),
      { src: 3, dst: 4, weight: 0.1 }, // 弱桥
    ]
    const nodes = [1, 2, 3, 4, 5, 6]
    const r1 = runLpa(nodes, edges)
    const r2 = runLpa(nodes, edges)
    assert.deepEqual(r1, r2)
    assert.equal(r1.length, 2)
    const sizes = r1.map(c => c.members.length).sort((a, b) => a - b)
    assert.deepEqual(sizes, [3, 3])
  })

  test('权重影响归属：强边吸入，弱边不吸', () => {
    // 孤立点 7 通过强边接入簇 A
    const edges: LpaEdge[] = [...chain([[1, 2], [2, 3], [1, 3]]), { src: 7, dst: 1, weight: 5 }]
    const r = runLpa([1, 2, 3, 7], edges)
    const clusterOf7 = r.find(c => c.members.includes(7))
    assert.ok(clusterOf7?.members.includes(1))
  })

  test('空图与孤立点', () => {
    assert.deepEqual(runLpa([], []), [])
    const r = runLpa([9], [])
    assert.equal(r.length, 1)
    assert.deepEqual(r[0]!.members, [9])
  })

  test('指纹对成员集合敏感', () => {
    assert.notEqual(fingerprintOf([1, 2, 3]), fingerprintOf([1, 2, 4]))
    assert.equal(fingerprintOf([3, 2, 1]), fingerprintOf([1, 2, 3])) // 排序后一致
  })
})

// ── PPR ──────────────────────────────────────────────────────────────────────

describe('runPpr', () => {

  test('hub 得分高于叶子', () => {
    // 链 1-2-3-4-5，种子 1
    const edges: PprEdge[] = chain([[1, 2], [2, 3], [3, 4], [4, 5]])
    const { scores } = runPpr([1, 2, 3, 4, 5], edges, new Map([[1, 1]]))
    assert.ok((scores.get(2) ?? 0) > (scores.get(5) ?? 0))
    assert.ok((scores.get(3) ?? 0) > (scores.get(5) ?? 0))
  })

  test('多种子：靠近两个种子的节点居前', () => {
    // 两个种子 1、6；节点 3 居中
    const edges: PprEdge[] = chain([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]])
    const { scores } = runPpr([1, 2, 3, 4, 5, 6], edges, new Map([[1, 1], [6, 1]]))
    assert.ok((scores.get(3) ?? 0) > (scores.get(1) ?? 0) * 0.9)
  })

  test('无种子返回空；收敛迭代不超过上限', () => {
    assert.deepEqual(runPpr([1], [], new Map()).scores.size, 0)
    const edges: PprEdge[] = chain([[1, 2], [2, 3]])
    const { iterations } = runPpr([1, 2, 3], edges, new Map([[1, 1]]), { iterations: 5 })
    assert.ok(iterations <= 6)
  })
})

// ── 三模式检索（真实 store）────────────────────────────────────────────────

let dir: string
let store: SqliteGraphStore

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-search-'))
  store = new SqliteGraphStore(join(dir, 's.db'))
  // 语料：订单→库存→通知 链 + 搜索→库存 + 支付→风控（显式实体表，避免正则贪婪）
  const docs: readonly (readonly [string, string, readonly string[]])[] = [
    ['order.md', '订单服务使用库存服务：下单时扣减库存', ['订单服务', '库存服务']],
    ['inventory.md', '库存服务使用通知服务：库存变更事件通知', ['库存服务', '通知服务']],
    ['search.md', '搜索服务使用库存服务：过滤无货商品', ['搜索服务', '库存服务']],
    ['pay.md', '支付服务使用风控服务：收单前评估', ['支付服务', '风控服务']],
  ]
  for (const [path, text, uniq] of docs) {
    const src = store.upsertSource({ path, absPath: `/ws/${path}`, contentHash: `h${path}`, sizeBytes: 1, mtimeMs: 1 })
    store.replaceChunks(src.id, [{ ordinal: 0, startLine: 1, endLine: 1, startCol: 0, endCol: 20, text, tokenEst: 20 } as ChunkInput])
    const chunkId = store.getChunks(src.id)[0]!.id
    const delta: ExtractionDelta = {
      sourceId: src.id, chunkId,
      entities: uniq.map(n2 => ({ normName: n2, name: n2, type: 'module' as const, description: null, confidence: 0.8 })),
      relations: uniq.length === 2
        ? [{ srcNorm: uniq[0] as string, dstNorm: uniq[1] as string, type: 'uses' as const, description: null, confidence: 0.8 }]
        : [],
      mentions: computeMentions(text, [...uniq]),
    }
    store.applyExtraction(delta)
  }
  recomputeCommunities(store)
  // 摘要：为每个社区放一份确定性摘要
  for (const c of store.listCommunities()) {
    const names = store.entitiesByCommunity(c.id, 10).map(e => e.name)
    store.putSummary({ communityId: c.id, summary: `该社区围绕${names.join('、')}协作`, entitiesTop: names, fingerprintAt: c.fingerprint })
  }
})

after(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('searchLocal', () => {

  test('词法种子 → PPR 扩散 → 证据包含原文 chunk 与关系', () => {
    const pack = searchLocal(store, '订单服务和库存服务如何协作')
    assert.equal(pack.mode, 'local')
    assert.ok(pack.entities.some(e => e.name === '订单服务'))
    assert.ok(pack.relations.some(r => r.s === '订单服务' && r.o === '库存服务'))
    assert.ok(pack.chunks.length >= 1)
    assert.match(pack.chunks[0]!.path, /order\.md|inventory\.md/)
    assert.equal(pack.meta.llmCalls, 0)
    assert.ok(pack.meta.pprIterations! >= 1)
  })

  test('无种子命中抛 NO_SEED', () => {
    assert.throws(() => searchLocal(store, '完全不相关词汇xyzzy'), (e: unknown) => e instanceof GraphRagError && e.code === 'NO_SEED')
  })
})

describe('searchGlobal', () => {

  test('社区摘要排序 + 代表实体 + chunk 引用', () => {
    const pack = searchGlobal(store, '订单库存通知的协作体系')
    assert.equal(pack.mode, 'global')
    assert.ok(pack.communities.length >= 1)
    assert.ok(pack.communities.some(c => c.note.includes('LLM 生成摘要')))
    assert.ok(pack.entities.length >= 1)
  })

  test('无摘要时 NOT_INDEXED', () => {
    const fresh = new SqliteGraphStore(':memory:')
    assert.throws(() => searchGlobal(fresh, 'x'), (e: unknown) => e instanceof GraphRagError && e.code === 'NOT_INDEXED')
    fresh.close()
  })
})

describe('searchTraversal', () => {

  test('正向遍历：订单服务 → 库存服务 → 通知服务', () => {
    const sub = searchTraversal(store, '订单服务', { direction: 'out', hops: 3 })
    assert.deepEqual(sub.ambiguousSeeds, [])
    assert.ok(sub.nodes.length >= 2)
    assert.ok(sub.edges.some(e => e.s === '订单服务' && e.o === '库存服务'))
    assert.ok(sub.edges.some(e => e.s === '库存服务' && e.o === '通知服务'))
    assert.ok(sub.edges.every(e => e.evidence[0]!.path !== '(无原文)'))
  })

  test('反向遍历（in）：谁依赖库存服务', () => {
    const sub = searchTraversal(store, '库存服务', { direction: 'in', hops: 1 })
    const names = sub.edges.map(e => e.s)
    assert.ok(names.includes('订单服务'))
    assert.ok(names.includes('搜索服务'))
    assert.ok(!names.includes('库存服务'))
  })

  test('模糊 seed 多命中 → ambiguousSeeds', () => {
    const sub = searchTraversal(store, '库存服务通知服务', { direction: 'both', hops: 1 })
    assert.ok(sub.ambiguousSeeds.length > 1)
    assert.equal(sub.nodes.length, 0)
  })

  test('不存在的 seed → NO_SEED', () => {
    assert.throws(() => searchTraversal(store, '不存在实体xyz'), (e: unknown) => e instanceof GraphRagError && e.code === 'NO_SEED')
  })
})
