import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { SqliteGraphStore, type ChunkInput, type ExtractionDelta } from '../src/core/graphstore.ts'

let dir: string
let store: SqliteGraphStore

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-store-'))
  store = new SqliteGraphStore(join(dir, 'test.db'))
})

after(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

const chunk = (ordinal: number, text: string): ChunkInput => ({
  ordinal, startLine: 1, endLine: 3, startCol: 0, endCol: 10, text, tokenEst: 10,
})

/** 便捷：建 source + 1 chunk + 返回 delta 构造器。 */
function seedFile(path: string, text: string): { sourceId: number; chunkId: number } {
  const src = store.upsertSource({ path, absPath: `/ws/${path}`, contentHash: `h-${path}`, sizeBytes: 100, mtimeMs: 1 })
  store.replaceChunks(src.id, [chunk(0, text)])
  const chunks = store.getChunks(src.id)
  assert.ok(chunks.length === 1)
  return { sourceId: src.id, chunkId: chunks[0]!.id }
}

function delta(sourceId: number, chunkId: number,
  entities: ExtractionDelta['entities'], relations: ExtractionDelta['relations'] = [],
  mentions: ExtractionDelta['mentions'] = []): ExtractionDelta {
  return { sourceId, chunkId, entities, relations, mentions }
}

describe('source / chunk 生命周期', () => {

  test('upsertSource 幂等：同路径更新 hash 并回到 pending', () => {
    const a = store.upsertSource({ path: 'a.md', absPath: '/ws/a.md', contentHash: 'h1', sizeBytes: 1, mtimeMs: 1 })
    const b = store.upsertSource({ path: 'a.md', absPath: '/ws/a.md', contentHash: 'h2', sizeBytes: 2, mtimeMs: 2 })
    assert.equal(b.id, a.id)
    assert.equal(store.getSource('a.md')?.contentHash, 'h2')
    assert.equal(store.getSource('a.md')?.state, 'pending')
  })

  test('replaceChunks 替换语义 + FTS 同步（旧 chunk 文本不再可检索）', () => {
    const { sourceId } = seedFile('b.md', '订单服务负责订单状态机')
    store.replaceChunks(sourceId, [chunk(0, '全新的库存对账文本')])
    const hits = store.searchChunks(['订单服', '状态机'], 5)
    assert.equal(hits.length, 0)
    const hits2 = store.searchChunks(['库存对', '对账文'], 5)
    assert.equal(hits2.length, 1)
    assert.equal(hits2[0]!.chunk.text, '全新的库存对账文本')
  })

  test('chunk 检索带路径与行号（举证面）', () => {
    seedFile('c.md', '支付服务对接渠道适配层')
    const hits = store.searchChunks(['支付服', '渠道适'], 3)
    assert.ok(hits.length >= 1)
    assert.equal(hits[0]!.chunk.sourcePath, 'c.md')
    assert.equal(typeof hits[0]!.chunk.startLine, 'number')
  })
})

describe('applyExtraction：归并与聚合', () => {

  test('实体 upsert + 别名 + 关系加权聚合 + mention 落库', () => {
    const { sourceId, chunkId } = seedFile('d.md', '订单服务使用库存服务')
    store.applyExtraction(delta(sourceId, chunkId,
      [
        { normName: '订单服务', name: '订单服务', type: 'module', description: '订单编排', confidence: 0.8 },
        { normName: '库存服务', name: '库存服务', type: 'module', description: null, confidence: 0.8 },
      ],
      [{ srcNorm: '订单服务', dstNorm: '库存服务', type: 'uses', description: '下单扣减', confidence: 0.8 }],
      [{ normName: '订单服务', spanStart: 0, spanEnd: 4 }, { normName: '库存服务', spanStart: 5, spanEnd: 9 }],
    ))
    const order = store.getEntity('订单服务')
    assert.ok(order)
    assert.equal(order.type, 'module')
    assert.equal(order.degree >= 1, true)

    // 第二次抽取同一关系：weight 聚合、置信度加权均值
    const { sourceId: s2, chunkId: c2 } = seedFile('e.md', '订单服务再次使用库存服务')
    store.applyExtraction(delta(s2, c2,
      [
        { normName: '订单服务', name: 'OrderService', type: 'module', description: null, confidence: 0.6 },
        { normName: '库存服务', name: '库存服务', type: 'module', description: '库存管理', confidence: 0.6 },
      ],
      [{ srcNorm: '订单服务', dstNorm: '库存服务', type: 'uses', description: null, confidence: 1.0 }],
      [{ normName: '订单服务', spanStart: 0, spanEnd: 4 }],
    ))
    const rels = store.allRelations()
    assert.equal(rels.length, 1)
    assert.equal(rels[0]!.weight, 2)
    assert.ok(Math.abs(rels[0]!.confidence - (0.8 + 1.0) / 2) < 1e-9)
    // 描述：先到先得，后来者不覆盖
    assert.equal(store.getEntity('订单服务')?.description, '订单编排')
    assert.equal(store.getEntity('库存服务')?.description, '库存管理')
    // chunk 级证据
    const chunksForOrder = store.chunksForEntities([store.getEntity('订单服务')!.id], 5)
    assert.equal(chunksForOrder.length, 2)
  })

  test('updateRelationEnds：人工更正端点/类型（实体按名 upsert + 清排除态 + 置信度 1）', () => {
    // 全程用独立命名 + 末尾 forget 还原现场（其他测试对 store 做全局断言）
    const { sourceId, chunkId } = seedFile('g.md', '更正库存服务推送更正通知服务')
    store.applyExtraction(delta(sourceId, chunkId,
      [
        { normName: '更正库存服务', name: '更正库存服务', type: 'module', description: null, confidence: 0.7 },
        { normName: '更正通知服务', name: '更正通知服务', type: 'module', description: null, confidence: 0.7 },
      ],
      [{ srcNorm: '更正库存服务', dstNorm: '更正通知服务', type: 'uses', description: '推送变更', confidence: 0.7 }],
      [{ normName: '更正库存服务', spanStart: 0, spanEnd: 6 }],
    ))
    const rel = store.allRelations().find(r => r.type === 'uses' && r.description === '推送变更')!
    store.excludeRelation(rel.id)
    const excludedBefore = store.excludedRelationCount()
    // 人工更正宾语：更正通知服务 → 更正短信网关（新实体，concept）
    const res = store.updateRelationEnds(rel.id, { dstName: '更正短信网关' })
    assert.equal(res.changed, true)
    assert.equal(store.excludedRelationCount(), excludedBefore - 1, '更正应清除该关系排除态')
    const relAfter = store.allRelations().find(r => r.id === rel.id)!
    assert.equal(Number(relAfter.confidence), 1, '人工确认置信度置 1')
    const gateway = store.getEntity('更正短信网关')!
    assert.equal(relAfter.dstId, gateway.id)
    assert.equal(gateway.type, 'concept', '缺失实体按 concept 建立')
    // 改类型 + 无实际变化分支
    assert.equal(store.updateRelationEnds(rel.id, { type: 'depends_on' }).changed, true)
    assert.equal(store.allRelations().find(r => r.id === rel.id)?.type, 'depends_on')
    assert.equal(store.updateRelationEnds(rel.id, {}).changed, false)
    // 还原共享 store：证据清扫删关系，孤儿实体（无 mention）随之清除
    store.forget({ kind: 'file', path: 'g.md' })
    assert.equal(store.allRelations().some(r => r.id === rel.id), false)
  })

  test('relationEvidence：同 chunk 双端点 mention 去重（JOIN 扇出回归）', () => {
    const { sourceId, chunkId } = seedFile('h.md', '更正库存服务推送更正通知服务')
    store.applyExtraction(delta(sourceId, chunkId,
      [
        { normName: '更正库存服务', name: '更正库存服务', type: 'module', description: null, confidence: 0.7 },
        { normName: '更正通知服务', name: '更正通知服务', type: 'module', description: null, confidence: 0.7 },
      ],
      [{ srcNorm: '更正库存服务', dstNorm: '更正通知服务', type: 'uses', description: '推送', confidence: 0.7 }],
      [
        { normName: '更正库存服务', spanStart: 0, spanEnd: 6 },
        { normName: '更正库存服务', spanStart: 10, spanEnd: 16 },
        { normName: '更正通知服务', spanStart: 7, spanEnd: 13 },
      ],
    ))
    const rel = store.allRelations().find(r => r.type === 'uses' && r.description === '推送')!
    const ev = store.relationEvidence(rel.id)
    assert.equal(ev.length, 1, '一个 chunk 一条证据，不被 mention 条数翻倍')
    assert.equal(ev[0]!.startLine, 1)
    store.forget({ kind: 'file', path: 'h.md' })
  })

  test('关系端点缺失时跳过，不炸批次', () => {
    const { sourceId, chunkId } = seedFile('f.md', '幽灵关系')
    const before = store.allRelations().length
    store.applyExtraction(delta(sourceId, chunkId, [],
      [{ srcNorm: '不存在甲', dstNorm: '不存在乙', type: 'uses', description: null, confidence: 0.9 }], []))
    assert.equal(store.allRelations().length, before)
  })

  test('findEntitiesByLexical 命中实体 FTS', () => {
    const hits = store.findEntitiesByLexical(['订单服'], 5)
    assert.ok(hits.length >= 1)
    assert.equal(hits[0]!.entity.normName, '订单服务')
  })

  test('neighbors 双向 + 类型过滤', () => {
    const inv = store.getEntity('库存服务')!
    const inbound = store.neighbors(inv.id, 'in', ['uses'])
    assert.equal(inbound.length, 1)
    assert.equal(inbound[0]!.srcName, '订单服务')
    const none = store.neighbors(inv.id, 'in', ['imports'])
    assert.equal(none.length, 0)
  })

  test('bfs 多跳 + 节点预算截断', () => {
    // 链：甲 → 乙 → 丙
    const { sourceId, chunkId } = seedFile('g.md', '甲使用乙，乙使用丙')
    store.applyExtraction(delta(sourceId, chunkId, [
      { normName: '甲', name: '甲', type: 'concept', description: null, confidence: 1 },
      { normName: '乙', name: '乙', type: 'concept', description: null, confidence: 1 },
      { normName: '丙', name: '丙', type: 'concept', description: null, confidence: 1 },
    ], [
      { srcNorm: '甲', dstNorm: '乙', type: 'uses', description: null, confidence: 1 },
      { srcNorm: '乙', dstNorm: '丙', type: 'uses', description: null, confidence: 1 },
    ], []))
    const jia = store.getEntity('甲')!
    const two = store.bfs([jia.id], 2, 'out', undefined, 100)
    assert.equal(two.nodes.length, 3)
    assert.equal(two.edges.length, 2)
    assert.equal(two.truncated, false)
    const capped = store.bfs([jia.id], 2, 'out', undefined, 2)
    assert.equal(capped.truncated, true)
    assert.ok(capped.nodes.length <= 2)
  })
})

describe('事务与恢复', () => {

  test('applyExtraction 异常整体回滚（mention 指向不存在的 chunk 触发外键违约）', () => {
    const countsBefore = store.counts()
    const { sourceId } = seedFile('h.md', '回滚用')
    assert.throws(() => store.applyExtraction(delta(sourceId, 999999,
      [{ normName: '回滚实体', name: '回滚实体', type: 'concept', description: null, confidence: 1 }], [],
      [{ normName: '回滚实体', spanStart: 0, spanEnd: 2 }])),
      /FOREIGN KEY/)
    // 实体未落库（回滚）
    assert.equal(store.getEntity('回滚实体'), null)
    assert.equal(store.counts().entities, countsBefore.entities)
  })

  test('重开库：迁移幂等 + 数据持久', () => {
    const dbPath = join(dir, 'reopen.db')
    const s1 = new SqliteGraphStore(dbPath)
    const { sourceId, chunkId } = (() => {
      const src = s1.upsertSource({ path: 'r.md', absPath: '/ws/r.md', contentHash: 'h', sizeBytes: 1, mtimeMs: 1 })
      s1.replaceChunks(src.id, [chunk(0, '重开测试：搜索服务使用库存服务')])
      const c = s1.getChunks(src.id)[0]!
      return { sourceId: src.id, chunkId: c.id }
    })()
    s1.applyExtraction(delta(sourceId, chunkId, [
      { normName: '搜索服务', name: '搜索服务', type: 'module', description: null, confidence: 0.8 },
      { normName: '库存服务', name: '库存服务', type: 'module', description: null, confidence: 0.8 },
    ], [{ srcNorm: '搜索服务', dstNorm: '库存服务', type: 'uses', description: null, confidence: 0.8 }],
      [{ normName: '搜索服务', spanStart: 0, spanEnd: 4 }]))
    s1.close()
    // 重开：migrate() 幂等执行，不抛错，数据在
    const s2 = new SqliteGraphStore(dbPath)
    assert.equal(s2.counts().entities, 2)
    assert.ok(s2.getEntity('搜索服务'))
    assert.equal(s2.searchChunks(['搜索服', '库存服'], 3).length, 1)
    assert.equal(s2.meta('schema_version'), '1')
    s2.close()
  })

  test('批次 checkpoint + 恢复扫描标记 aborted', () => {
    const b1 = store.startBatch(3)
    store.finishBatch(b1, 'done', { llmCalls: 2, tokensIn: 100, tokensOut: 50 })
    const b2 = store.startBatch(5)
    const recovered = store.recoverInterruptedBatches()
    assert.equal(recovered, 1)
    const batches = store.listBatches()
    assert.equal(batches.find(b => b.id === b2)?.status, 'aborted')
    assert.equal(batches.find(b => b.id === b1)?.status, 'done')
  })
})

describe('隔离区', () => {

  test('quarantine 存取 + 过滤已解决', () => {
    const { chunkId } = seedFile('i.md', '解析失败样本')
    store.quarantinePut(chunkId, '原始输入', '畸形输出', 'PARSE_FAILED', 'unexpected token')
    store.quarantinePut(null, '另一输入', null, 'LLM_ERROR', 'RATE_LIMIT')
    assert.equal(store.quarantineList().length, 2)
    const first = store.quarantineList()[0]!
    store.quarantineResolve(first.id)
    assert.equal(store.quarantineList().length, 1)
    assert.equal(store.quarantineList(true).length, 2)
  })
})

describe('forget 级联', () => {

  test('forget(file)：证据清扫 → 零证据关系删除 → 孤儿实体清理', () => {
    const { sourceId: s1, chunkId: c1 } = seedFile('j1.md', '风控服务使用用户服务')
    store.applyExtraction(delta(s1, c1, [
      { normName: '风控服务', name: '风控服务', type: 'module', description: null, confidence: 0.8 },
      { normName: '用户服务', name: '用户服务', type: 'module', description: null, confidence: 0.8 },
    ], [{ srcNorm: '风控服务', dstNorm: '用户服务', type: 'uses', description: null, confidence: 0.8 }],
      [{ normName: '风控服务', spanStart: 0, spanEnd: 4 }]))
    const { sourceId: s2, chunkId: c2 } = seedFile('j2.md', '用户服务独立文档')
    store.applyExtraction(delta(s2, c2, [], [],
      [{ normName: '用户服务', spanStart: 0, spanEnd: 4 }]))

    assert.ok(store.getEntity('风控服务'))
    const report = store.forget({ kind: 'file', path: 'j1.md' })
    assert.equal(report.deleted.chunks, 1)
    assert.equal(report.deleted.entities, 1) // 风控服务成为孤儿被清
    assert.equal(store.getEntity('风控服务'), null)
    // 用户服务仍有 j2 的 mention，保留
    assert.ok(store.getEntity('用户服务'))
    // 关系因零证据被删
    assert.equal(store.allRelations().filter(r => r.type === 'uses' && r.srcId === store.getEntity('用户服务')?.id).length, 0)
  })

  test('forget(entity)：级联删除关系与 mention', () => {
    const { sourceId, chunkId } = seedFile('k.md', '促销服务使用用户服务')
    store.applyExtraction(delta(sourceId, chunkId, [
      { normName: '促销服务', name: '促销服务', type: 'module', description: null, confidence: 0.8 },
      { normName: '用户服务', name: '用户服务', type: 'module', description: null, confidence: 0.8 },
    ], [{ srcNorm: '促销服务', dstNorm: '用户服务', type: 'uses', description: null, confidence: 0.8 }],
      [{ normName: '促销服务', spanStart: 0, spanEnd: 4 }]))
    const report = store.forget({ kind: 'entity', name: '促销服务' })
    assert.equal(report.deleted.entities, 1)
    assert.equal(report.deleted.relations, 1)
    assert.equal(store.getEntity('促销服务'), null)
  })

  test('forget(graph)：全量重置', () => {
    const report = store.forget({ kind: 'graph' })
    assert.ok(report.deleted.entities >= 1)
    const c = store.counts()
    assert.equal(c.entities, 0)
    assert.equal(c.relations, 0)
    assert.equal(c.sources, 0)
  })
})

describe('性能预算（0202 §6 设计点抽检）', () => {

  test('1.5 万实体 / 4 万边量级写入与遍历在预算内', () => {
    const t0 = performance.now()
    const { sourceId, chunkId } = seedFile('perf.md', '性能测试基准文件')
    // 批量构造：500 组 × 30 实体链
    for (let g = 0; g < 500; g++) {
      const entities = Array.from({ length: 30 }, (_, i) => ({
        normName: `perf${g}x${i}`, name: `Perf${g}X${i}`, type: 'concept' as const, description: null, confidence: 0.8,
      }))
      const relations = Array.from({ length: 29 }, (_, i) => ({
        srcNorm: `perf${g}x${i}`, dstNorm: `perf${g}x${i + 1}`, type: 'uses' as const, description: null, confidence: 0.8,
      }))
      store.applyExtraction(delta(sourceId, chunkId, entities, relations, []))
    }
    const writeMs = performance.now() - t0
    assert.equal(store.counts().entities, 15000)
    assert.equal(store.counts().relations, 14500)

    const t1 = performance.now()
    const start = store.getEntity('perf0x0')!
    const sub = store.bfs([start.id], 2, 'out', undefined, 500)
    const bfsMs = performance.now() - t1
    assert.ok(sub.nodes.length >= 3)
    // 预算：写 < 30s（含 500 事务），遍历 < 1s（宽松 CI 上界；设计预算 100ms 量级）
    assert.ok(writeMs < 30_000, `write ${writeMs}ms`)
    assert.ok(bfsMs < 1_000, `bfs ${bfsMs}ms`)
  })
})

describe('审查排除与别名（审计修复回归）', () => {

  test('excludeRelation 后：neighbors/relationsAmong/sampleRelations 一律过滤', () => {
    const { sourceId, chunkId } = seedFile('excl.md', '甲服务调用乙服务')
    store.applyExtraction(delta(sourceId, chunkId,
      [{ normName: '甲服务', name: '甲服务', type: 'module', description: null, confidence: 0.8 },
        { normName: '乙服务', name: '乙服务', type: 'module', description: null, confidence: 0.7 }],
      [{ srcNorm: '甲服务', dstNorm: '乙服务', type: 'uses', description: null, confidence: 0.7 }]))
    const a = store.getEntity('甲服务')!
    const b = store.getEntity('乙服务')!
    const rel = store.allRelations().find(r => r.srcId === a.id && r.dstId === b.id)!
    assert.ok(store.neighbors(a.id, 'both').length >= 1)
    assert.ok(store.relationsAmong(new Set([a.id, b.id])).length >= 1)
    store.excludeRelation(rel.id)
    assert.equal(store.neighbors(a.id, 'both').length, 0)
    assert.equal(store.relationsAmong(new Set([a.id, b.id])).length, 0)
    // 重启语义：排除态持久于 confidence<0，抽样不再翻出（无内存排除表也一样）
    assert.equal(store.sampleRelations(10, []).some(x => x.relation.id === rel.id), false)
    assert.equal(store.excludedRelationCount(), 1)
  })

  test('别名并入 FTS 行后，按首见名检索仍命中（rebuild 不丢行）', () => {
    const { sourceId, chunkId } = seedFile('alias.md', 'ApiGateway 是入口')
    store.applyExtraction(delta(sourceId, chunkId,
      [{ normName: 'apigateway', name: 'ApiGateway', type: 'api', description: null, confidence: 0.8 }]))
    // 第二次以同 norm 变体名出现（大小写/符号差异）→ 追加别名并重建 FTS 行
    store.applyExtraction(delta(sourceId, chunkId,
      [{ normName: 'apigateway', name: 'API Gateway', type: 'api', description: null, confidence: 0.9 }]))
    const ent = store.getEntity('apigateway')!
    assert.equal(ent.name, 'ApiGateway') // 首见展示名保留
    const hits = store.findEntitiesByLexical(['apigateway'], 5)
    assert.ok(hits.some(h => h.entity.id === ent.id))
  })
})
