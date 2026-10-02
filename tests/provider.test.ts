/** M2-W1（v2 多知识库）集成测试：seam 注册表 / adapter / provider 端到端
 * 与降级矩阵 / KB 生命周期与解析链（0207 §2）。 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import type { Context } from '@deepseek-ai/cordis'

import { callerFrom, llmCompleterOf, resolveDataDir, workspaceDir } from '../src/adapter.ts'
import { GraphRagServiceImpl, type GraphRagProvider } from '../src/index.ts'
import { clampConfig, declaredKbsOf, LocalGraphRagProvider } from '../src/provider.ts'
import { GraphRagError, type EvidencePack, type ForgetReport, type IndexReport, type IndexStatus, type Subgraph } from '../src/core/types.ts'
import type { LlmCompleter } from '../src/core/extractor.ts'

// ── seam 注册表 ──────────────────────────────────────────────────────────────

describe('GraphRagServiceImpl', () => {
  const fake = (id: string): GraphRagProvider => ({
    id,
    listKbs: () => [],
    createKb: () => { throw new Error('not impl') },
    updateKb: () => { throw new Error('not impl') },
    deleteKb: () => ({ deleted: { chunks: 0, mentions: 0, relations: 0, entities: 0, summaries: 0 }, communitiesRebuilt: 0 }),
    status: async () => ({}) as IndexStatus,
    index: async () => ({}) as IndexReport,
    indexBackground: () => ({ started: false }),
    progress: () => null,
    cancelIndex: () => false,
    query: async () => ({}) as EvidencePack,
    traverse: async () => ({}) as Subgraph,
    forget: async () => ({}) as ForgetReport,
    estimate: () => ({ files: 0, estCalls: 0 }),
    browseEntities: () => [],
    sampleForReview: () => [],
    correctFromSelection: async () => ({ triples: [] }),
    listKnowledge: () => [],
    addTextKnowledge: () => ({ file: '', started: false }),
    forgetKnowledge: async () => ({ deleted: { chunks: 0, relations: 0, entities: 0 } }),
    reviewRelation: () => ({ excluded: false, corrected: false }),
    healthReport: () => ({ kbName: '', files: { indexed: 0, stale: 0, quarantined: 0 }, coverage: null, quarantineRate: null, sampled: 0, correct: 0, corrected: 0, samplePrecision: null, excludedRelations: 0, lastIndexAt: null }),
  })

  test('单 provider 自动选中；注销函数生效', () => {
    const s = new GraphRagServiceImpl()
    const off = s.register(fake('local-sqlite'))
    assert.equal(s.resolve().id, 'local-sqlite')
    off()
    assert.throws(() => s.resolve(), (e: unknown) => e instanceof GraphRagError && e.code === 'NO_PROVIDER')
  })

  test('多 provider 需 pin；pin 未知 id 抛错；重复注册抛错', () => {
    const s = new GraphRagServiceImpl()
    s.register(fake('a'))
    s.register(fake('b'))
    assert.throws(() => s.resolve(), /多个 provider/)
    assert.equal(s.resolve('b').id, 'b')
    assert.throws(() => s.resolve('c'), /未注册/)
    assert.throws(() => s.register(fake('a')), /重复注册/)
  })
})

// ── adapter ──────────────────────────────────────────────────────────────────

describe('adapter', () => {

  test('resolveDataDir 优先级：显式配置 > 环境变量 > DSH_HOME > 默认', () => {
    assert.equal(resolveDataDir('/cfg', {}), '/cfg')
    assert.equal(resolveDataDir(undefined, { GRAPHRAG_DATA_DIR: '/env' }), '/env')
    assert.equal(resolveDataDir(undefined, { DSH_HOME: '/dsh' }), '/dsh/graphrag')
    assert.ok(resolveDataDir(undefined, {}).endsWith(join('.dsh', 'graphrag')))
  })

  test('workspaceDir（旧布局迁移路径）稳定且不泄露路径明文', () => {
    assert.equal(workspaceDir('/data', '/ws/a'), workspaceDir('/data', '/ws/a'))
    assert.notEqual(workspaceDir('/data', '/ws/a'), workspaceDir('/data', '/ws/b'))
  })

  test('callerFrom 防御性解构；垃圾输入安全', () => {
    const c = callerFrom({ agent: { session: { id: 's1', header: { cwd: '/ws' } } } })
    assert.deepEqual(c, { sessionId: 's1', cwd: '/ws' })
    assert.deepEqual(callerFrom(null), {})
    assert.deepEqual(callerFrom({ agent: { session: { id: 42 } } }), {})
  })
})

// ── llmCompleterOf：流装配 / 失败码 / 退避 ─────────────────────────────────

function fakeCtx(streamImpl: (opts: unknown) => AsyncIterable<unknown>): Context {
  return { llm: { stream: streamImpl } } as unknown as Context
}

describe('llmCompleterOf', () => {

  test('文本增量装配为完整输出', async () => {
    const ctx = fakeCtx(async function* () {
      yield { type: 'text-delta', text: 'Hello ' }
      yield { type: 'text-delta', text: 'World' }
      yield { type: 'finish' }
    })
    const llm = llmCompleterOf(ctx, { provider: 'p', model: 'm' })
    assert.equal(await llm.complete('sys', 'usr'), 'Hello World')
  })

  test('RATE_LIMIT 指数退避后成功', async () => {
    let calls = 0
    const ctx = fakeCtx(async function* () {
      calls++
      if (calls <= 2) { yield { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'busy' } }; return }
      yield { type: 'text-delta', text: 'ok' }
    })
    const llm = llmCompleterOf(ctx, { provider: 'p', model: 'm' }, { baseDelayMs: 1 })
    assert.equal(await llm.complete('s', 'u'), 'ok')
    assert.equal(calls, 3)
  })

  test('MISSING_CREDENTIAL 映射稳定错误码', async () => {
    const ctx = fakeCtx(async function* () {
      yield { kind: 'error', failure: { code: 'MISSING_CREDENTIAL', message: 'no key' } }
    })
    const llm = llmCompleterOf(ctx, { provider: 'p', model: 'm' })
    await assert.rejects(llm.complete('s', 'u'), (e: unknown) => e instanceof GraphRagError && e.code === 'MISSING_CREDENTIAL')
  })

  test('RATE_LIMIT 耗尽 → NO_PROVIDER；aborted signal 直接抛 ABORTED', async () => {
    const ctx = fakeCtx(async function* () {
      yield { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'x' } }
    })
    const llm = llmCompleterOf(ctx, { provider: 'p', model: 'm' }, { rateLimitRetries: 0 })
    await assert.rejects(llm.complete('s', 'u'), (e: unknown) => e instanceof GraphRagError && e.code === 'NO_PROVIDER')

    const controller = new AbortController()
    controller.abort()
    await assert.rejects(llm.complete('s', 'u', controller.signal), (e: unknown) => e instanceof GraphRagError && e.code === 'ABORTED')
  })
})

// ── provider v2：多知识库端到端 ─────────────────────────────────────────────

const KNOWN = ['订单服务', '库存服务', '通知服务']
const oracleLlm: LlmCompleter = {
  complete: async (_s, user) => {
    if (user.includes('社区主题摘要')) return JSON.stringify({ summary: `社区：${KNOWN.join('、')}`, top: KNOWN })
    const found = KNOWN.filter(n => user.includes(n))
    const rels: { s: string; r: string; o: string; d: null; c: number }[] = []
    for (let i = 0; i + 1 < found.length; i += 2) rels.push({ s: found[i] as string, r: 'uses', o: found[i + 1] as string, d: null, c: 0.8 })
    return JSON.stringify({ entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })), relations: rels })
  },
}

describe('LocalGraphRagProvider v2（多知识库）', () => {
  let dir: string

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'graphrag-provider-'))
    mkdirSync(join(dir, 'docs-a'), { recursive: true })
    mkdirSync(join(dir, 'docs-b'), { recursive: true })
    writeFileSync(join(dir, 'docs-a', 'a.md'), '订单服务使用库存服务。\n')
    writeFileSync(join(dir, 'docs-b', 'b.md'), '库存服务使用通知服务。\n')
  })

  after(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  let seq = 0
  const makeProvider = (declared: { kbs?: readonly { name?: unknown; roots?: readonly unknown[]; description?: unknown }[] } = {}): LocalGraphRagProvider => {
    seq++
    return new LocalGraphRagProvider(clampConfig({ dataDir: join(dir, `state-${seq}`) }), { ctx: null, llm: oracleLlm }, declaredKbsOf(declared))
  }

  test('clampConfig：空 roots / 坏 model / 越界数值全部钳制', () => {
    const c = clampConfig({ roots: ['ok', '', 42], model: { provider: '', model: 'm' }, extract: { minConfidence: 9 } })
    assert.equal(c.model, null)
    assert.equal(c.extract.minConfidence, 1)
  })

  test('declaredKbsOf：非法项跳过（无名/无 roots）', () => {
    const d = declaredKbsOf({ kbs: [{ name: 'A', roots: ['/x'] }, { roots: ['/y'] }, { name: 'B', roots: ['ok'] }] })
    assert.deepEqual(d, [{ name: 'A', roots: ['/x'], description: null }, { name: 'B', roots: ['ok'], description: null }])
  })

  test('配置声明库自动注册（config 托管，拒绝 update/delete）', () => {
    const p = makeProvider({ kbs: [{ name: '配置库A', roots: [join(dir, 'docs-a')] }] })
    try {
      assert.deepEqual(p.listKbs().map(k => k.name), ['配置库A'])
      assert.equal(p.listKbs()[0]!.managed, 'config')
      assert.throws(() => p.updateKb(p.listKbs()[0]!.id, { name: 'x' }), /配置托管/)
    } finally {
      p.dispose()
    }
  })

  test('addTextKnowledge → listKnowledge → forgetKnowledge（llm 在场：落文件并启动索引）', async () => {
    const p = makeProvider()
    const kb = p.createKb({ name: '笔记库', roots: [] })
    const r = p.addTextKnowledge({ id: kb.id }, '补充知识一', '智算中心按节点规模定容量。')
    const fs = await import('node:fs')
    assert.ok(fs.existsSync(r.file), '笔记文件已落盘')
    // oracle LLM 同步完成：轮询至后台索引 done，来源清单应收编笔记
    for (let i = 0; i < 200; i++) {
      const prog = p.progress(kb.id)
      if (prog?.phase === 'done') break
      if (prog?.phase === 'error') throw new Error(prog.error ?? '后台索引失败')
      await new Promise(resolve => { setTimeout(resolve, 20) })
    }
    const list = p.listKnowledge({ id: kb.id })
    assert.equal(list.length, 1)
    assert.equal(list[0]!.isNote, true)
    const gone = p.forgetKnowledge({ id: kb.id }, list[0]!.path)
    const report = await gone
    assert.ok(report.deleted.chunks >= 1, '图谱数据级联清除')
    assert.ok(!fs.existsSync(r.file), '笔记物理文件同步删除')
  })

  test('createKb → index → query（kb 显式指定）→ traverse → forget', async () => {
    const p = makeProvider()
    try {
      const kb = p.createKb({ name: 'atlas 代码库', roots: [join(dir, 'docs-a')] })
      assert.equal(kb.id, 'atlas')
      assert.equal(p.listKbs().length, 1)

      const report = await p.index({ name: 'atlas 代码库' }, {}, new AbortController().signal)
      assert.equal(report.files.new, 1)
      assert.ok(p.listKbs()[0]!.lastIndexedAt !== null, 'touchIndexed 回写')

      const pack = await p.query({ name: 'atlas 代码库' }, { question: '订单服务和库存服务如何协作', mode: 'local' })
      assert.ok(pack.entities.some(e => e.name === '订单服务'))

      const sub = await p.traverse({ name: 'atlas 代码库' }, { seed: '订单服务', direction: 'out', hops: 2 })
      assert.ok(sub.edges.length >= 1)

      const st = await p.status({ name: 'atlas 代码库' })
      assert.equal(st.kbName, 'atlas 代码库')
      assert.equal(st.files.indexed, 1)
      assert.equal(st.llmAvailable, true)

      const fr = await p.forget({ name: 'atlas 代码库' }, { kind: 'graph' })
      assert.ok(fr.deleted.entities >= 1)
    } finally {
      p.dispose()
    }
  })

  test('多库解析链：显式 name 命中；cwd 命中唯一库；多库无名 → KB_AMBIGUOUS 带候选', async () => {
    const p = makeProvider()
    try {
      const a = p.createKb({ name: '库A', roots: [join(dir, 'docs-a')] })
      p.createKb({ name: '库B', roots: [join(dir, 'docs-b')] })
      // cwd 命中库A roots → 默认解析到库A
      assert.equal(p.resolveKb(undefined, join(dir, 'docs-a', 'sub')).name, '库A')
      // 显式 name
      assert.equal(p.resolveKb({ name: '库B' }).name, '库B')
      // cwd 不在任何 roots 且未指定 → KB_AMBIGUOUS，候选名单可见
      try {
        p.resolveKb(undefined, '/nonexistent')
        assert.fail('should throw')
      } catch (e) {
        assert.ok(e instanceof GraphRagError && e.code === 'KB_AMBIGUOUS')
        assert.match(e.message, /库A \/ 库B/)
      }
      // 未知名 → KB_AMBIGUOUS
      assert.throws(() => p.resolveKb({ name: '不存在' }), (e: unknown) => e instanceof GraphRagError && e.code === 'KB_AMBIGUOUS')
      void a
    } finally {
      p.dispose()
    }
  })

  test('唯一库免指定；status 总览聚合', async () => {
    const p = makeProvider()
    try {
      p.createKb({ name: 'only', roots: [join(dir, 'docs-a')] })
      await p.index({}, {}, new AbortController().signal) // 唯一库：undefined 也可
      const pack = await p.query(undefined, { question: '订单服务和库存服务', mode: 'local' })
      assert.ok(pack.entities.length >= 1)
      // 加第二个库 → 总览
      p.createKb({ name: 'second', roots: [join(dir, 'docs-b')] })
      await p.index({ name: 'second' }, {}, new AbortController().signal)
      const overview = await p.status() // 无 target
      assert.equal(overview.kbName, null)
      assert.deepEqual(overview.kbsOverview.map(k => k.name), ['only', 'second'])
      assert.equal(overview.files.indexed, 2)
    } finally {
      p.dispose()
    }
  })

  test('deleteKb 级联清除存储目录与注册项', async () => {
    const p = makeProvider()
    try {
      const kb = p.createKb({ name: 'temp', roots: [join(dir, 'docs-a')] })
      await p.index({ name: 'temp' }, {}, new AbortController().signal)
      const report = p.deleteKb(kb.id)
      assert.ok(report.deleted.entities >= 1)
      assert.equal(p.listKbs().length, 0)
      await assert.rejects(p.query({ name: 'temp' }, { question: 'x', mode: 'local' }),
        (e: unknown) => e instanceof GraphRagError && e.code === 'KB_AMBIGUOUS')
    } finally {
      p.dispose()
    }
  })

  test('降级矩阵：无 llm → index 抛 NO_PROVIDER；query 走 NOT_INDEXED；零 roots → NOT_AUTHORIZED', async () => {
    const p = new LocalGraphRagProvider(clampConfig({ dataDir: join(dir, 's2') }), { ctx: null })
    try {
      const kb = p.createKb({ name: 'nollm', roots: [join(dir, 'docs-a')] })
      await assert.rejects(p.index({ name: kb.name }, {}, new AbortController().signal),
        (e: unknown) => e instanceof GraphRagError && e.code === 'NO_PROVIDER')
      await assert.rejects(p.query(undefined, { question: 'x', mode: 'local' }),
        (e: unknown) => e instanceof GraphRagError && e.code === 'NOT_INDEXED')
    } finally {
      p.dispose()
    }
    const p2 = new LocalGraphRagProvider(clampConfig({ dataDir: join(dir, 's3') }), { ctx: null, llm: oracleLlm })
    try {
      p2.createKb({ name: 'noroots', roots: [] })
      await assert.rejects(p2.index({ name: 'noroots' }, {}, new AbortController().signal),
        (e: unknown) => e instanceof GraphRagError && e.code === 'NOT_AUTHORIZED')
    } finally {
      p2.dispose()
    }
  })

  test('旧布局迁移：workspaces/<hash> → legacy KB（数据可检索）', async () => {
    // 预置旧布局：手工造一个 workspace 目录（借 provider 旧路径构造）
    const dataDir = join(dir, 'legacy-state')
    const { mkdirSync: mk, writeFileSync: wf } = await import('node:fs')
    const { createHash } = await import('node:crypto')
    const cwd = '/private/tmp'
    const hash = createHash('sha256').update(cwd).digest('hex').slice(0, 16)
    const legacyDbDir = join(dataDir, 'workspaces', hash)
    mk(legacyDbDir, { recursive: true })
    // 用 v2 provider 在目标位置建库再搬移？直接用 SqliteGraphStore 建旧布局库：
    const { SqliteGraphStore } = await import('../src/core/graphstore.ts')
    const legacy = new SqliteGraphStore(join(legacyDbDir, 'graphrag.db'))
    const src = legacy.upsertSource({ path: 'x.md', absPath: '/ws/x.md', contentHash: 'h', sizeBytes: 1, mtimeMs: 1 })
    legacy.replaceChunks(src.id, [{ ordinal: 0, startLine: 1, endLine: 1, startCol: 0, endCol: 4, text: '订单服务使用库存服务', tokenEst: 10 }])
    const chunkId = legacy.getChunks(src.id)[0]!.id
    legacy.applyExtraction({
      sourceId: src.id, chunkId,
      entities: [
        { normName: '订单服务', name: '订单服务', type: 'module', description: null, confidence: 0.8 },
        { normName: '库存服务', name: '库存服务', type: 'module', description: null, confidence: 0.8 },
      ],
      relations: [{ srcNorm: '订单服务', dstNorm: '库存服务', type: 'uses', description: null, confidence: 0.8 }],
      mentions: [{ normName: '订单服务', spanStart: 0, spanEnd: 4 }],
    })
    legacy.close()

    // 新 provider 指向同一 dataDir → 触发迁移
    const p = new LocalGraphRagProvider(clampConfig({ dataDir }), { ctx: null, llm: oracleLlm },
      [{ name: '迁移库', roots: [join(dir, 'docs-a')], description: null }])
    try {
      assert.equal(p.listKbs().length, 2) // legacy + 配置声明的「迁移库」
      const legacyKb = p.listKbs().find(k => /^legacy-/.test(k.name))!
      assert.ok(legacyKb)
      // 迁移后的库数据可检索（按 name 显式定位）
      const pack = await p.query({ name: legacyKb.name }, { question: '订单服务和库存服务', mode: 'local' })
      assert.ok(pack.entities.some(e => e.name === '订单服务'))
    } finally {
      p.dispose()
    }
  })
})
