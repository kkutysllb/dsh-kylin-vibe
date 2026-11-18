/** M2-W2 工具契约测试（0204 §2/§3/§5 验收）：五工具参数/输出/错误文案 +
 * 审批门触发边界。用真实 LocalGraphRagProvider（oracle llm）端到端驱动，
 * 宿主面（tools/systemPrompt/agents/on）用最小桩。 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import type { Context } from '@deepseek-ai/cordis'

import { callerFrom } from '../src/adapter.ts'
import type { LlmCompleter } from '../src/core/extractor.ts'
import { GraphRagServiceImpl } from '../src/index.ts'
import { clampConfig, LocalGraphRagProvider } from '../src/provider.ts'
import { ANNOUNCEMENT, apply as applyTools, approvalDecision, graphragToolDefs, MUTATING_TOOLS, renderEvidencePack } from '../src/tool.ts'
import type { GraphRagProvider } from '../src/index.ts'

// ── 宿主桩 ───────────────────────────────────────────────────────────────────

interface HostStub {
  ctx: Context
  registered: { agentTools: string[]; sections: { name: string; order: number; text: string }[] }
}

/** 宿主 agent 注册表形状（v0.1.6 兼容矩阵）：
 * - `roots`：QiLin 3.x / 老版 DSH —— 有 roots()，注册表含根与子代理；
 * - `list`：DSH ≥0.2.2-rc.2 —— 只有 list()，注册表里只剩根；
 * - `both`：过渡期宿主两种都有；
 * - `throwing`：roots()/list() 都抛错（注册表已释放等）；
 * - `none`：服务存在但没有任何读法。 */
type RegistryShape = 'roots' | 'list' | 'both' | 'throwing' | 'none'

function hostStub(roots: unknown[] = [], shape: RegistryShape = 'roots'): HostStub & { listeners: Map<string, unknown>; agents: unknown[] } {
  const registered = { agentTools: [] as string[], sections: [] as { name: string; order: number; text: string }[] }
  const listeners = new Map<string, unknown>()
  const makeScoped = (): Context => {
    const scoped = {
      effect(fn: () => unknown): unknown { const v = fn(); return typeof v === 'function' ? v : () => {} },
      tools: {
        register(def: { name: string }): () => void {
          registered.agentTools.push(def.name)
          return () => { registered.agentTools = registered.agentTools.filter(n => n !== def.name) }
        },
      },
    }
    return scoped as unknown as Context
  }
  const agents = [
    { id: 'agent-1', session: { id: 'sess-1', header: { cwd: '/ws' } }, ctx: makeScoped() },
  ]
  const live = roots.length > 0 ? roots : agents
  const throwing = (): never => { throw new TypeError('agents.roots is not a function') }
  const registry: Record<string, unknown> = { on: (_e: string, _cb: unknown) => () => {} }
  if (shape === 'throwing') {
    registry['roots'] = throwing
    registry['list'] = throwing
  } else {
    if (shape === 'roots' || shape === 'both') registry['roots'] = () => live
    if (shape === 'list' || shape === 'both') registry['list'] = () => live
  }
  const ctx = {
    graphrag: undefined,
    logger: { warn: (_m: string) => {} },
    effect(fn: () => unknown): unknown { const v = fn(); return typeof v === 'function' ? v : () => {} },
    on(event: string, cb: (p: unknown, next?: () => Promise<unknown>) => unknown): () => void {
      listeners.set(event, cb)
      return () => {}
    },
    tools: { register: (_def: unknown) => () => {} },
    systemPrompt: { section(s: { name: string; order: number; text: string }) { registered.sections.push(s); return () => {} } },
    agents: registry,
  }
  return { ctx: ctx as unknown as Context, registered, listeners, agents }
}

// ── 被测组合：seam + provider（oracle）+ 工具 ───────────────────────────────

const KNOWN = ['订单服务', '库存服务', '通知服务']
const oracleLlm: LlmCompleter = {
  complete: async (_s, user) => {
    if (user.includes('社区主题摘要')) return JSON.stringify({ summary: '模块协作社区', top: KNOWN })
    const found = KNOWN.filter(n => user.includes(n))
    const rels: { s: string; r: string; o: string; d: null; c: number }[] = []
    for (let i = 0; i + 1 < found.length; i += 2) rels.push({ s: found[i] as string, r: 'uses', o: found[i + 1] as string, d: null, c: 0.8 })
    return JSON.stringify({ entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })), relations: rels })
  },
}

let dir: string
let service: GraphRagServiceImpl
let provider: LocalGraphRagProvider
let defs: ReturnType<typeof graphragToolDefs>
let host: HostStub

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-tools-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'a.md'), '订单服务使用库存服务。\n')
  writeFileSync(join(dir, 'docs', 'b.md'), '库存服务使用通知服务。\n')
  service = new GraphRagServiceImpl()
  provider = new LocalGraphRagProvider(clampConfig({
    roots: [join(dir, 'docs')],
    dataDir: join(dir, 'state'),
  }), { ctx: null, llm: oracleLlm })
  service.register(provider)
  host = hostStub()
  // 工具工厂以 caller.cwd=/ws 调用，provider 以 /ws 为 cwd 建库 → 需与 docs 对齐：
  // 直接把 provider 的 cwd 视作 '/ws'：数据目录隔离按 cwd hash，测试用真实 cwd。
  defs = graphragToolDefs({ resolve: pin => service.resolve(pin) })
})

after(() => {
  provider.dispose()
  rmSync(dir, { recursive: true, force: true })
})

/** exec 构造：cwd 指向测试 docs 目录。 */
function execOf(args: unknown, opts: { signal?: AbortSignal; cwd?: string } = {}): unknown {
  return {
    arguments: args,
    signal: opts.signal ?? new AbortController().signal,
    agent: { session: { id: 'sess-1', header: { cwd: opts.cwd ?? join(dir, 'docs') } } },
  }
}

function defByName(name: string): { execute: (args: unknown, exec: unknown) => Promise<unknown>; parameters: unknown; description: string; timeoutMs: number } {
  const d = defs.find(x => (x as { name: string }).name === name) as never
  if (d === undefined) throw new Error(`missing tool ${name}`)
  return d
}

describe('五工具契约（端到端）', () => {

  test('工具名册 5 个 + 公告段文案注入', () => {
    assert.deepEqual(defs.map(d => (d as { name: string }).name),
      ['graphrag_query', 'graphrag_graph', 'graphrag_status', 'graphrag_index', 'graphrag_forget'])
    assert.equal(MUTATING_TOOLS.size, 2)
    assert.ok(ANNOUNCEMENT.includes('graphrag_query') && ANNOUNCEMENT.includes('path+lines'))
    assert.ok(ANNOUNCEMENT.length <= 400, `公告 ${ANNOUNCEMENT.length} 字`)
  })

  test('no-session 拒绝：无 cwd 的 exec 被拒', async () => {
    const q = defByName('graphrag_query')
    const out = await q.execute({ question: 'x' }, { arguments: {}, signal: new AbortController().signal, agent: { session: {} } })
    assert.equal((out as { ok: boolean }).ok, false)
    assert.match((out as { error: { code: string } }).error.code, /no-session/)
  })

  test('index(create 语义) → query(kb) → graph → status 总览/单库 → forget 全链路（真实 provider）', async () => {
    const cwd = join(dir, 'docs')
    // index + create：kb 不存在 → 新建库并后台索引（审批在宿主层，工具直接执行）
    const idx = defByName('graphrag_index')
    const r0 = await idx.execute({ kb: '工具冒烟库', create: true, roots: [cwd] }, execOf({})) as { ok: boolean; value: { started: boolean } }
    assert.equal(r0.ok, true)
    assert.equal(r0.value.started, true)
    assert.ok(provider.listKbs().some(k => k.name === '工具冒烟库'), 'create 语义应落库注册表')
    // 后台执行：轮询至完成（fixture 2 文件亚秒级）再继续检索断言
    const smokeKbId = provider.listKbs().find(k => k.name === '工具冒烟库')!.id
    for (let i = 0; i < 200; i++) {
      const p = provider.progress(smokeKbId)
      if (p?.phase === 'done') break
      if (p?.phase === 'error') throw new Error(p.error ?? '后台索引失败')
      await new Promise(resolve => { setTimeout(resolve, 20) })
    }
    assert.equal(provider.progress(smokeKbId)?.phase, 'done')

    // create 缺 roots → invalid
    const r0b = await idx.execute({ kb: '无目录库', create: true }, execOf({})) as { ok: boolean; error: { code: string } }
    assert.equal(r0b.ok, false)
    assert.equal(r0b.error.code, 'invalid')

    // query local（kb 显式指定）
    const q = defByName('graphrag_query')
    const r2 = await q.execute({ question: '订单服务和库存服务如何协作', kb: '工具冒烟库' }, execOf({})) as { ok: boolean; value: { mode: string; chunks: unknown[]; entities: unknown[] } }
    assert.equal(r2.ok, true)
    assert.equal(r2.value.mode, 'local')
    assert.ok(r2.value.entities.length >= 1)

    // query 参数校验：空 question
    const r2b = await q.execute({ question: '' }, execOf({})) as { ok: boolean; error: { code: string } }
    assert.equal(r2b.ok, false)
    assert.equal(r2b.error.code, 'invalid')

    // graph 遍历 + 反向影响
    const g = defByName('graphrag_graph')
    const r3 = await g.execute({ seed: '库存服务', direction: 'in', hops: 1, kb: '工具冒烟库' }, execOf({})) as { ok: boolean; value: { edges: { s: string }[] } }
    assert.equal(r3.ok, true)
    assert.ok(r3.value.edges.some(e => e.s === '订单服务'))

    // status 总览（不传 kb）+ 单库
    const st = defByName('graphrag_status')
    const r4 = await st.execute({}, execOf({})) as { ok: boolean; value: { kbName: null; kbsOverview: { name: string; filesIndexed: number }[]; files: { indexed: number }; graph: { entities: number } } }
    assert.equal(r4.ok, true)
    assert.equal(r4.value.kbName, null)
    assert.ok(r4.value.kbsOverview.some(k => k.name === '工具冒烟库' && k.filesIndexed === 2))
    const r4b = await st.execute({ kb: '工具冒烟库' }, execOf({})) as { ok: boolean; value: { kbName: string; files: { indexed: number }; graph: { entities: number } } }
    assert.equal(r4b.ok, true)
    assert.equal(r4b.value.kbName, '工具冒烟库')
    assert.equal(r4b.value.files.indexed, 2)
    assert.ok(r4b.value.graph.entities >= 3)

    // forget file 级联（kb 内）
    const f = defByName('graphrag_forget')
    const r5 = await f.execute({ kb: '工具冒烟库', target: { kind: 'file', path: 'b.md' } }, execOf({})) as { ok: boolean; value: { deleted: { chunks: number } } }
    assert.equal(r5.ok, true)
    assert.equal(r5.value.deleted.chunks, 1)

    // forget target 形状校验
    const r5b = await f.execute({ target: { kind: 'galaxy' } }, execOf({})) as { ok: boolean; error: { code: string } }
    assert.equal(r5b.ok, false)
    assert.equal(r5b.error.code, 'invalid')
  })

  test('GraphRagError → 稳定错误码 + 模型可读短文案（0204 §5）', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'graphrag-tools-fresh-'))
    try {
      // 已建但未索引的空库 → NOT_INDEXED（单库默认链不再按 cwd 拦截）
      provider.createKb({ name: '空库', roots: [fresh] })
      const q = defByName('graphrag_query')
      const out = await q.execute({ question: 'x', kb: '空库' }, execOf({}, { cwd: fresh })) as { ok: boolean; error: { code: string; message: string } }
      assert.equal(out.ok, false)
      assert.equal(out.error.code, 'NOT_INDEXED')
      assert.ok(out.error.message.includes('graphrag_index'), '短文案给出下一步动作')
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  test('renderEvidencePack 有界：超长 chunk 文本截断', () => {
    const rendered = renderEvidencePack({}, {
      mode: 'local', question: 'q', entities: [], relations: [], communities: [],
      chunks: [{ path: 'a', lines: '1-2', text: 'x'.repeat(5000) }],
      meta: { mode: 'local', seedHits: 1, pprIterations: 1, llmCalls: 0, coverage: '' },
    })
    const text = (rendered[0] as { text: string }).text
    assert.ok(text.includes('…[截断]'))
    assert.ok(text.length < 5000 + 500)
  })
})

describe('审批门（0204 §3 边界）', () => {

  test('挂载 agent 的 index/forget 触发 ask（双语 + dry-run 估算）', () => {
    const est = (): { files: number; estCalls: number } => ({ files: 3, estCalls: 4 })
    const exec = { name: 'graphrag_index', arguments: {}, signal: new AbortController().signal, agent: { session: { id: 's', header: { cwd: '/ws' } } } }
    const idx = approvalDecision(exec, true, est)
    assert.ok(idx?.kind === 'ask')
    assert.ok(idx.reason.includes('graphrag_index') && idx.reason.includes('3') && idx.reason.includes('4'))
    assert.match(idx.displayReason.zh, /图谱索引/)
    assert.match(idx.displayReason.en, /GraphRAG index/)

    const forget = approvalDecision(
      { name: 'graphrag_forget', arguments: { target: { kind: 'graph' } }, signal: new AbortController().signal },
      true,
    )
    assert.ok(forget?.kind === 'ask')
    assert.ok(forget.reason.includes('ENTIRE graph'))
  })

  test('未挂载 / aborted / 非变更工具 → 不拦截', () => {
    const signal = new AbortController().signal
    assert.equal(approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, false), undefined)
    assert.equal(approvalDecision({ name: 'graphrag_query', arguments: {}, signal }, true), undefined)
    const aborted = new AbortController()
    aborted.abort()
    assert.equal(approvalDecision({ name: 'graphrag_index', arguments: {}, signal: aborted.signal }, true), undefined)
  })

  test('estimate 抛错时不阻塞审批（通用文案）', () => {
    const bad = (): never => { throw new Error('boom') }
    const d = approvalDecision({ name: 'graphrag_index', arguments: {}, signal: new AbortController().signal }, true, bad)
    assert.ok(d?.kind === 'ask')
    assert.ok(!d.reason.includes('undefined'))
  })

  test('回归 policy=never：不让 ask 自动落败——拒绝 + 真实原因 + 可操作出路', () => {
    // 宿主对 never 会话的 ask 会确定性解析 rejected，模型看到
    // "the user rejected tool"（并非用户拒绝）。审批门必须改走拒绝路径。
    const est = (): { files: number; estCalls: number } => ({ files: 2, estCalls: 3 })
    const signal = new AbortController().signal
    const index = approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, est, { approvalPolicy: 'never' })
    assert.equal(index?.kind, 'deny')
    const indexReason = (index as { reason: string }).reason
    assert.ok(indexReason.includes('approval policy = never'), '说明真实原因')
    assert.ok(indexReason.includes('"the user rejected tool"'), '澄清宿主文案是自动拒绝')
    assert.ok(indexReason.includes('不是用户拒绝'), '不得冒充用户否决')
    assert.ok(indexReason.includes('知识图谱') && indexReason.includes('「索引」'), '给出面板出路')
    assert.ok(indexReason.includes('mutatingApproval'), '给出配置出路')
    assert.ok(indexReason.includes('不要重试'), '防重试循环')

    const forget = approvalDecision(
      { name: 'graphrag_forget', arguments: { target: { kind: 'graph' } }, signal },
      true,
      undefined,
      { approvalPolicy: 'never' },
    )
    assert.equal(forget?.kind, 'deny')
    const forgetReason = (forget as { reason: string }).reason
    assert.ok(forgetReason.includes('graphrag_forget') && forgetReason.includes('删除'), 'forget 文案指向删除入口')

    // ask 会话（或探测失败）行为不变：照常 ask
    const askMode = approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, est, { approvalPolicy: 'ask' })
    assert.equal(askMode?.kind, 'ask')
    const unknown = approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, est, {})
    assert.equal(unknown?.kind, 'ask')
  })

  test('回归 mutatingApproval=allow：预授权后审批门整体放行', () => {
    const signal = new AbortController().signal
    assert.equal(approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, undefined, { mutatingApproval: 'allow' }), undefined)
    assert.equal(
      approvalDecision({ name: 'graphrag_forget', arguments: { target: { kind: 'graph' } }, signal }, true, undefined, { approvalPolicy: 'never', mutatingApproval: 'allow' }),
      undefined,
    )
  })

  test('回归 完全权限预设：sandbox danger-full-access → 放行（引擎原生工具「权限或审批二选一」同款）', () => {
    // 桌面端「完全权限」预设 = sandbox full + approval never 同写：用户已预授权
    // （预设描述明确含「敏感操作」），审批门再问必败（never 的 ask 被宿主确定性拒绝）。
    const signal = new AbortController().signal
    const est = (): { files: number; estCalls: number } => ({ files: 2, estCalls: 3 })
    // full + never：放行（本缺陷的主场景）
    assert.equal(approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, est, { sandboxMode: 'danger-full-access', approvalPolicy: 'never' }), undefined)
    // full + ask（Auto 预设）：沙箱已放开即授权，同样放行
    assert.equal(approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, est, { sandboxMode: 'danger-full-access', approvalPolicy: 'ask' }), undefined)
    // forget 同语义（销毁性操作含在预设授权内）
    assert.equal(
      approvalDecision({ name: 'graphrag_forget', arguments: { target: { kind: 'graph' } }, signal }, true, undefined, { sandboxMode: 'danger-full-access', approvalPolicy: 'never' }),
      undefined,
    )
    // confined + never：仍走拒绝路径（无人值守 fail-closed，不回归）
    const denied = approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, est, { sandboxMode: 'workspace-write', approvalPolicy: 'never' })
    assert.equal(denied?.kind, 'deny')
    // 沙箱探测失败 + never：fail-closed 不变
    assert.equal(approvalDecision({ name: 'graphrag_index', arguments: {}, signal }, true, est, { approvalPolicy: 'never' })?.kind, 'deny')
  })
})

describe('apply 挂载接线（seam → 工具面）', () => {

  test('挂载：5 工具注册到根 agent + 公告段 + pre-execute 拦截 index', async () => {
    const stub = hostStub()
    ;(stub.ctx as unknown as { graphrag?: unknown }).graphrag = service
    applyTools(stub.ctx, {})
    // 公告段注入
    assert.equal(stub.registered.sections.length, 1)
    assert.equal(stub.registered.sections[0]!.name, 'plugin:dsh-kylin-vibe/tool')
    assert.equal(stub.registered.sections[0]!.order, 210)
    // 5 工具挂到根 agent 的 scoped tools
    assert.equal(stub.registered.agentTools.length, 5)
    // pre-execute：index 调用被升级为 ask（next 先行 allow → 决策替换）
    const hook = stub.listeners.get('tools/pre-execute') as
      (exec: unknown, next: () => Promise<{ kind: string }>) => Promise<unknown>
    assert.equal(typeof hook, 'function')
    const decision = await hook(
      { name: 'graphrag_index', arguments: {}, signal: new AbortController().signal,
        agent: { session: { id: 'sess-1', header: { cwd: join(dir, 'docs') } } } },
      async () => ({ kind: 'allow' }),
    )
    assert.ok((decision as { kind: string }).kind === 'ask')
    // 非 graphrag 工具透传 downstream
    const passthrough = await hook(
      { name: 'bash', arguments: {}, signal: new AbortController().signal,
        agent: { session: { id: 'sess-1', header: { cwd: '/ws' } } } },
      async () => ({ kind: 'allow' }),
    )
    assert.deepEqual(passthrough, { kind: 'allow' })
  })

  test('回归：never 会话 pre-execute 直接拒绝（不产生必败 ask）；mutatingApproval=allow 放行', async () => {
    // 宿主 ApprovalService 在 never 会话把 ask 确定性解析 rejected 并显示
    // "the user rejected tool"（并非用户拒绝）——pre-execute 必须提前改道。
    const stub = hostStub()
    ;(stub.ctx as unknown as { graphrag?: unknown }).graphrag = service
    ;(stub.ctx as unknown as { reflect?: unknown }).reflect = {
      get: (name: string) => (name === 'approval' ? { overrideOf: () => 'never', config: { policy: 'ask' } } : undefined),
    }
    applyTools(stub.ctx, {})
    const hook = stub.listeners.get('tools/pre-execute') as
      (exec: unknown, next: () => Promise<{ kind: string }>) => Promise<unknown>
    const exec = {
      name: 'graphrag_index', arguments: {}, signal: new AbortController().signal,
      agent: { session: { id: 'sess-1', header: { cwd: join(dir, 'docs') } } },
    }
    const decision = await hook(exec, async () => ({ kind: 'allow' }))
    assert.equal((decision as { kind: string }).kind, 'deny')
    assert.ok((decision as { reason: string }).reason.includes('不是用户拒绝'), '拒绝文案必须澄清自动拒绝')

    // 预授权配置 → 放行（即使 never 会话）
    const stub2 = hostStub()
    ;(stub2.ctx as unknown as { graphrag?: unknown }).graphrag = service
    ;(stub2.ctx as unknown as { reflect?: unknown }).reflect = {
      get: (name: string) => (name === 'approval' ? { overrideOf: () => 'never' } : undefined),
    }
    applyTools(stub2.ctx, { mutatingApproval: 'allow' })
    const hook2 = stub2.listeners.get('tools/pre-execute') as typeof hook
    const decision2 = await hook2(exec, async () => ({ kind: 'allow' }))
    assert.deepEqual(decision2, { kind: 'allow' })
  })

  test('回归：完全权限预设（approval never + sandbox full）pre-execute 放行，不再误拒', async () => {
    // 桌面端「完全权限」= sandbox danger-full-access + approval never 两旋钮同写；
    // 审批门必须识别沙箱半边并让路——否则比「工作区修改」还严（语义倒挂）。
    const stub = hostStub()
    ;(stub.ctx as unknown as { graphrag?: unknown }).graphrag = service
    ;(stub.ctx as unknown as { reflect?: unknown }).reflect = {
      get: (name: string) => name === 'approval'
        ? { overrideOf: () => 'never', config: { policy: 'ask' } }
        : name === 'sandboxPolicy' ? { resolve: () => ({ mode: 'danger-full-access' }) } : undefined,
    }
    applyTools(stub.ctx, {})
    const hook = stub.listeners.get('tools/pre-execute') as
      (exec: unknown, next: () => Promise<{ kind: string }>) => Promise<unknown>
    const exec = {
      name: 'graphrag_index', arguments: {}, signal: new AbortController().signal,
      agent: { session: { id: 'sess-1', header: { cwd: join(dir, 'docs') } } },
    }
    const decision = await hook(exec, async () => ({ kind: 'allow' }))
    assert.deepEqual(decision, { kind: 'allow' }, '完全权限下 index 不拦截，直接沿 downstream 放行')
  })

  test('seam 缺席 → 降级：不挂载工具、不注公告、仅告警', () => {
    const stub = hostStub()
    applyTools(stub.ctx, {})
    assert.equal(stub.registered.agentTools.length, 0)
    assert.equal(stub.registered.sections.length, 0)
  })

  // ── v0.1.6 回归：DSH 0.2.2-rc.3 删除 AgentRegistry.roots() 导致安装失败 ──────

  test('回归 DSH ≥0.2.2-rc.2：注册表只有 list()（无 roots）→ 激活不抛错、5 工具照常挂载', () => {
    const stub = hostStub([], 'list')
    ;(stub.ctx as unknown as { graphrag?: unknown }).graphrag = service
    assert.doesNotThrow(() => { applyTools(stub.ctx, {}) }, 'ctx.agents.roots is not a function 不得再冒泡到激活期')
    assert.equal(stub.registered.agentTools.length, 5)
  })

  test('回归：注册表两种读法都抛错 → apply 不抛错（不判定安装失败），agent/created 仍能挂载', () => {
    const stub = hostStub([], 'throwing')
    ;(stub.ctx as unknown as { graphrag?: unknown }).graphrag = service
    assert.doesNotThrow(() => { applyTools(stub.ctx, {}) })
    assert.equal(stub.registered.agentTools.length, 0)
    const created = stub.listeners.get('agent/created') as (p: unknown) => void
    created(stub.agents[0])
    assert.equal(stub.registered.agentTools.length, 5)
  })

  test('回归：注册表没有任何读法（agents={}）→ apply 不抛错，事件兜底挂载', () => {
    const stub = hostStub([], 'none')
    ;(stub.ctx as unknown as { graphrag?: unknown }).graphrag = service
    assert.doesNotThrow(() => { applyTools(stub.ctx, {}) })
    const created = stub.listeners.get('agent/created') as (p: unknown) => void
    created(stub.agents[0])
    assert.equal(stub.registered.agentTools.length, 5)
  })

  test('兼容保留：roots() 存在时仍按根集过滤，子代理不重复挂载', () => {
    const stub = hostStub([], 'roots')
    ;(stub.ctx as unknown as { graphrag?: unknown }).graphrag = service
    applyTools(stub.ctx, {})
    assert.equal(stub.registered.agentTools.length, 5)
    const created = stub.listeners.get('agent/created') as (p: unknown) => void
    const scoped = (stub.agents[0] as { ctx: unknown }).ctx
    created({ agent: { id: 'child-1', session: { id: 'sess-child' }, ctx: scoped } })
    assert.equal(stub.registered.agentTools.length, 5, '子代理不属于根集，不应再挂 5 个工具')
  })
})
