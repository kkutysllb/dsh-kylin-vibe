import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { runIngest, type CommunitySummarizer } from '../src/core/ingest.ts'
import { SqliteGraphStore } from '../src/core/graphstore.ts'
import { GraphRagError } from '../src/core/types.ts'
import { assertAuthorized } from '../src/core/scanner.ts'
import type { LlmCompleter } from '../src/core/extractor.ts'

let dir: string
let store: SqliteGraphStore

/** 微型 oracle LLM：从 chunk 文本中识别已知实体名并产出关系 JSON。 */
const KNOWN = ['甲服务', '乙服务', '丙服务', '丁服务']
function oracleJson(text: string): string {
  const found = KNOWN.filter(n => text.includes(n))
  const rels: { s: string; r: string; o: string; d: null; c: number }[] = []
  for (let i = 0; i + 1 < found.length; i += 2) {
    rels.push({ s: found[i] as string, r: 'uses', o: found[i + 1] as string, d: null, c: 0.8 })
  }
  return JSON.stringify({
    entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })),
    relations: rels,
  })
}

function oracleLlm(calls: { n: number }): LlmCompleter {
  return {
    complete: async (_sys, user) => {
      calls.n++
      return oracleJson(user)
    },
  }
}

const summarize: CommunitySummarizer = async input =>
  `社区：${input.members.map(m => m.name).join('、')}`

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-ingest-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'a.md'), '# 甲\n\n甲服务使用乙服务完成编排。\n')
  writeFileSync(join(dir, 'docs', 'b.md'), '# 乙\n\n乙服务使用丙服务落地存储。\n')
  mkdirSync(join(dir, 'state'), { recursive: true })
  store = new SqliteGraphStore(join(dir, 'state', 'g.db'))
})

after(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('runIngest 全管线', () => {

  test('首次索引：建源/建图/社区/摘要 + 成本报告', async () => {
    const calls = { n: 0 }
    const report = await runIngest(store, { authorizedRoots: [join(dir, 'docs')] }, { llm: oracleLlm(calls), summarize })
    assert.equal(report.aborted, false)
    assert.equal(report.files.new, 2)
    assert.equal(report.files.deleted, 0)
    assert.ok(report.graphDelta.entitiesAdded >= 3)
    assert.ok(report.graphDelta.relationsAdded >= 2)
    assert.ok(report.graphDelta.communitiesRebuilt >= 1)
    assert.ok(report.graphDelta.summariesRecomputed >= 1)
    assert.equal(report.cost.llmCalls, calls.n + report.graphDelta.summariesRecomputed) // 摘要调用计入成本
    assert.ok(store.getEntity('甲服务'))
    assert.ok(store.allRelations().some(r => r.type === 'uses'))
    assert.ok(store.allSummaries().length >= 1)
    assert.deepEqual(store.listSources().map(s => s.state), ['merged', 'merged'])
  })

  test('稳态增量：无变更 → 零 LLM 调用', async () => {
    const calls = { n: 0 }
    const report = await runIngest(store, { authorizedRoots: [join(dir, 'docs')] }, { llm: oracleLlm(calls), summarize })
    assert.equal(report.files.new, 0)
    assert.equal(report.files.changed, 0)
    assert.equal(report.cost.llmCalls, 0)
  })

  test('文件变更：只处理脏文件', async () => {
    writeFileSync(join(dir, 'docs', 'a.md'), '# 甲 v2\n\n甲服务使用丁服务的新链路。\n')
    const calls = { n: 0 }
    const report = await runIngest(store, { authorizedRoots: [join(dir, 'docs')] }, { llm: oracleLlm(calls), summarize })
    assert.equal(report.files.changed, 1)
    assert.ok(report.cost.llmCalls >= 1)
    assert.ok(store.getEntity('丁服务'))
  })

  test('文件删除：级联清源', async () => {
    unlinkSync(join(dir, 'docs', 'b.md'))
    const report = await runIngest(store, { authorizedRoots: [join(dir, 'docs')] }, { llm: oracleLlm({ n: 0 }), summarize })
    assert.equal(report.files.deleted, 1)
    assert.equal(store.getSource('b.md'), null)
  })

  test('排除模式：.env* 与 node_modules 不入库', async () => {
    mkdirSync(join(dir, 'docs', 'node_modules', 'x'), { recursive: true })
    writeFileSync(join(dir, 'docs', 'node_modules', 'x', 'm.js'), '甲服务')
    writeFileSync(join(dir, 'docs', '.env.local'), 'SECRET=1')
    const report = await runIngest(store, { authorizedRoots: [join(dir, 'docs')] }, { llm: oracleLlm({ n: 0 }), summarize })
    assert.equal(store.getSource('.env.local'), null)
    assert.equal(store.getSource('node_modules/x/m.js'), null)
    assert.equal(report.files.new, 0)
  })

  test('未授权根 → 整根拒绝（报告非异常）+ assertAuthorized 抛错', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'graphrag-out-'))
    writeFileSync(join(outside, 'secret.md'), '甲服务')
    try {
      const report = await runIngest(store, { authorizedRoots: [join(dir, 'docs')], roots: [outside] }, { llm: oracleLlm({ n: 0 }), summarize })
      assert.equal(report.files.new, 0) // 整根被拒，无文件入库
      assert.throws(() => assertAuthorized(outside, [join(dir, 'docs')]),
        (e: unknown) => e instanceof GraphRagError && e.code === 'NOT_AUTHORIZED')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('abort 中断 → 可续跑且终态与一次跑完一致', async () => {
    // 重建独立目录与库
    const d2 = mkdtempSync(join(tmpdir(), 'graphrag-abort-'))
    mkdirSync(join(d2, 'docs'), { recursive: true })
    writeFileSync(join(d2, 'docs', 'a.md'), '# 甲\n\n甲服务使用乙服务。\n')
    writeFileSync(join(d2, 'docs', 'b.md'), '# 乙\n\n乙服务使用丙服务。\n')
    writeFileSync(join(d2, 'docs', 'c.md'), '# 丙\n\n丙服务使用丁服务。\n')
    const s2 = new SqliteGraphStore(join(d2, 'g.db'))
    try {
      const controller = new AbortController()
      const slowLlm: LlmCompleter = {
        complete: async (_s, u) => {
          if (u.includes('丙服务')) controller.abort() // 在第 2 个文件处理中触发
          return oracleJson(u)
        },
      }
      const r1 = await runIngest(s2, { authorizedRoots: [join(d2, 'docs')] }, { llm: slowLlm, summarize }, controller.signal)
      assert.equal(r1.aborted, true)
      // 终态不一致：存在非 merged 源
      const states = s2.listSources().map(x => x.state)
      assert.ok(states.some(st => st !== 'merged'), JSON.stringify(states))

      // 续跑：从断点补齐
      const calls = { n: 0 }
      const r2 = await runIngest(s2, { authorizedRoots: [join(d2, 'docs')] }, { llm: oracleLlm(calls), summarize })
      assert.equal(r2.aborted, false)
      assert.ok(r2.cost.llmCalls > 0, '续跑应处理未完成文件')
      assert.deepEqual(s2.listSources().map(x => x.state).every(st => st === 'merged'), true)
      for (const n of KNOWN) assert.ok(s2.getEntity(n), `续跑后 ${n} 应存在`)

      // 对照组：一次跑完的图与其一致（实体集 + 关系数）
      const d3 = mkdtempSync(join(tmpdir(), 'graphrag-full-'))
      mkdirSync(join(d3, 'docs'), { recursive: true })
      for (const f of ['a.md', 'b.md', 'c.md']) writeFileSync(join(d3, 'docs', f), readFileSync(join(d2, 'docs', f), 'utf8'))
      const s3 = new SqliteGraphStore(join(d3, 'g.db'))
      await runIngest(s3, { authorizedRoots: [join(d3, 'docs')] }, { llm: oracleLlm({ n: 0 }), summarize })
      assert.deepEqual(
        [...s2.allEntities().map(e => e.normName)].sort(),
        [...s3.allEntities().map(e => e.normName)].sort(),
      )
      assert.equal(s2.counts().relations, s3.counts().relations)
      s3.close()
      rmSync(d3, { recursive: true, force: true })
    } finally {
      s2.close()
      rmSync(d2, { recursive: true, force: true })
    }
  })

  test('畸形输出 → 隔离区计数且不污染主图', async () => {
    const d4 = mkdtempSync(join(tmpdir(), 'graphrag-q-'))
    mkdirSync(join(d4, 'docs'), { recursive: true })
    writeFileSync(join(d4, 'docs', 'bad.md'), '甲服务使用乙服务。')
    const s4 = new SqliteGraphStore(join(d4, 'g.db'))
    try {
      const garbage: LlmCompleter = { complete: async () => '我不是 JSON' }
      const report = await runIngest(s4, { authorizedRoots: [join(d4, 'docs')] }, { llm: garbage, summarize })
      assert.equal(report.quarantined, 1)
      assert.equal(s4.quarantineList().length, 1)
      assert.equal(s4.counts().entities, 0)
      assert.deepEqual(s4.listSources().map(x => x.state), ['quarantined'])
    } finally {
      s4.close()
      rmSync(d4, { recursive: true, force: true })
    }
  })
})

describe('CONTEXT_WINDOW 对半细分（0203 §1.5 调用纪律）', () => {

  test('整块超窗 → 行边界对半各抽一次成功；不再隔离', async () => {
    const d = mkdtempSync(join(tmpdir(), 'graphrag-cw-'))
    try {
      mkdirSync(join(d, 'docs'), { recursive: true })
      writeFileSync(join(d, 'docs', 'big.md'), '甲服务使用乙服务完成编排。\n\n' + '背景说明填充内容。'.repeat(20) + '\n丙服务使用丁服务。\n')
      const st = new SqliteGraphStore(join(d, 'g.db'))
      try {
        let full = 0
        let halves = 0
        const llm: LlmCompleter = {
          complete: async (_sys, user) => {
            // 整块同时含首尾两段（甲…与丙…）；对半后任一半只含其一
            if (user.includes('甲服务') && user.includes('丙服务')) {
              full++
              throw new GraphRagError('CONTEXT_WINDOW', '文本块超出模型上下文窗口')
            }
            halves++
            return oracleJson(user)
          },
        }
        const report = await runIngest(st, { authorizedRoots: [join(d, 'docs')] }, { llm, summarize })
        assert.ok(full >= 1, '整块调用触发超窗')
        assert.ok(halves >= 2, '对半后各半至少各抽一次')
        assert.equal(report.quarantined, 0)
        assert.ok(st.listSources().every(s => s.state === 'merged'))
        assert.ok(st.getEntity('甲服务'))
      } finally { st.close() }
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
})
