/** Agent 工具 Consumer（docs/02-design/0204）：五个工具 + 审批门 + 能力公告。
 *
 * 挂载模式照抄 dsh-kylin-automation（已验证双引擎）：根 agent scoped 注册、
 * agent/created·disposed 跟随、tools/pre-execute 先 next() 后升级（仅 allow
 * 时拦截）、公告段单段有界。错误码 → 模型短文案映射见 0204 §5。
 */

import { callerFrom, type ToolCaller } from './adapter.ts'
import { ERROR_CODES, GraphRagError, type EvidencePack, type ErrorCode, type IndexReport, type IndexStatus, type Subgraph } from './core/types.ts'
import type { GraphRagProvider, GraphRagService, IndexOptions, KbRef } from './index.ts'
import type { Context } from '@deepseek-ai/cordis'

// ── 错误码 → 模型可读短文案（0204 §5）──────────────────────────────────────

const ERROR_TEXT: Record<ErrorCode, string> = {
  NOT_AUTHORIZED: '该路径未被授权索引；请让用户在配置（cordis.patch.yml 的 graphrag-provider-local 行）中添加 roots 后重试。',
  NOT_INDEXED: '工作区尚未建立图谱；先调用 graphrag_index（需用户审批）。',
  INDEX_IN_PROGRESS: '索引进行中；稍后重试，或先用 graphrag_status 查看进度。',
  NO_SEED: '检索词未命中任何实体；换一种表述，或先用 grep 定位实体名，再用 graphrag_graph 从该实体遍历。',
  AMBIGUOUS_SEED: '种子名命中多个实体（见返回的 ambiguousSeeds）；用更精确的名称重试。',
  KB_AMBIGUOUS: '知识库定位不明确（见错误详情中的候选名单）；用 kb 参数指定确切名称重试。',
  INVALID: '参数不合法（见错误详情）。',
  QUARANTINED: '部分内容抽取失败被隔离；可用 graphrag_index 且 retryQuarantined=true 重放。',
  NO_PROVIDER: '宿主未配置模型 provider；索引与摘要不可用，词法检索与图遍历不受影响。',
  MISSING_CREDENTIAL: '宿主模型凭据缺失；请让用户在宿主模型设置中补全。',
  ABORTED: '已中止；索引进度已存档，可再次 graphrag_index 续跑。',
  SCHEMA_FUTURE: '图谱数据由更新版本的插件创建；请先升级插件。',
}

const CALLER_CWD_MESSAGE = '无法定位调用者工作区（需要活跃会话）(the caller workspace is unresolvable)'

class ToolRejection extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ToolRejection'
  }
}

function toolEnvelope(error: unknown): { readonly ok: false; readonly error: { readonly code: string; readonly message: string } } {
  if (error instanceof ToolRejection) return { ok: false, error: { code: error.code, message: error.message } }
  if (error instanceof GraphRagError) {
    return { ok: false, error: { code: error.code, message: `${ERROR_TEXT[error.code]}（${error.message}）` } }
  }
  return { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } }
}

function requireCallerCwd(caller: ToolCaller): string {
  if (caller.cwd === undefined) throw new ToolRejection('no-session', CALLER_CWD_MESSAGE)
  return caller.cwd
}

/** 工具参数 → KbRef：仅当 kb 非空时指定；缺省走 provider 默认解析链。 */
function kbRefOf(a: Record<string, unknown>): { name: string } | undefined {
  return typeof a['kb'] === 'string' && a['kb'].trim() !== '' ? { name: a['kb'].trim() } : undefined
}

// ── 工具定义工厂（纯函数，脱离宿主可测）────────────────────────────────────

export interface ToolServices {
  resolve(pin?: string): GraphRagProvider
}

export interface ToolConfig {
  /** 多 provider 时 pin（缺省自动选择）。 */
  readonly providerPin?: string
}

const jsonRender = (_args: unknown, value: unknown): readonly { type: 'text'; text: string }[] => [
  { type: 'text' as const, text: JSON.stringify(value, null, 2) },
]

/** 证据包的有界 render：chunk 原文每块截断（防止单块超长撑爆上下文）。
 * 宿主对 error 信封同样调用 render（0.2.0 实测）——非证据包形状一律退回
 * 原样 JSON，绝不让渲染层抛错。 */
export function renderEvidencePack(_args: unknown, value: unknown): readonly { type: 'text'; text: string }[] {
  const pack = value as Partial<EvidencePack> | undefined
  if (pack === null || typeof pack !== 'object' || !Array.isArray(pack.chunks) || !Array.isArray(pack.entities)) {
    return [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  }
  const bounded = {
    ...pack,
    chunks: pack.chunks.map(c => ({ ...c, text: c.text.length > 4000 ? `${c.text.slice(0, 4000)}…[截断]` : c.text })),
  }
  return [{ type: 'text' as const, text: JSON.stringify(bounded, null, 2) }]
}

const outputObject = { schema: { type: 'object' } as Record<string, unknown> }

export function graphragToolDefs(services: ToolServices, config: ToolConfig = {}): readonly unknown[] {
  const resolve = (): GraphRagProvider => services.resolve(config.providerPin)

  const queryDef = {
    name: 'graphrag_query',
    description: '在已索引的工作区知识图谱上检索证据。关系性问题（X 如何影响 Y、X 与 Y 的关联机制）用 mode=local；全局性问题（整体架构、主要模块划分、设计思路）用 mode=global。返回结构化证据包：chunks 是原文一级证据（引用结论必须落到其 path+lines），entities/relations/communities 是辅助理解的结构层。',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: '自然语言问题（≤500 字）' },
        mode: { type: 'string', enum: ['local', 'global'], description: '缺省 local：local=关系/实体级检索（零 LLM）；global=社区摘要全局检索' },
        maxTokens: { type: 'number', description: '证据包 token 预算，缺省 6000，上限 12000' },
        kb: { type: 'string', description: '可选：知识库名；缺省按工作区自动匹配（多库时必须指定）' },
      },
      required: ['question'],
    },
    output: { schema: outputObject.schema, render: renderEvidencePack },
    timeoutMs: 120_000,
    execute: async (args: unknown, exec: unknown) => {
      const caller = callerFrom(exec)
      try {
        const cwd = requireCallerCwd(caller)
        const a = args as Record<string, unknown>
        const question = a['question']
        if (typeof question !== 'string' || question.trim() === '') {
          throw new ToolRejection('invalid', 'question 必须是非空字符串')
        }
        const mode = a['mode'] === 'global' ? 'global' : 'local'
        const maxTokens = typeof a['maxTokens'] === 'number' ? Math.min(Math.max(a['maxTokens'], 1000), 12_000) : undefined
        const pack = await resolve().query(kbRefOf(a), { question: question.slice(0, 500), mode, maxTokens }, cwd)
        return { ok: true, value: pack }
      } catch (error) {
        return toolEnvelope(error)
      }
    },
  }

  const graphDef = {
    name: 'graphrag_graph',
    description: '从实体出发做多跳图遍历：影响面分析用 direction=in（反查谁依赖它）、调用链追踪用 out。不调用 LLM，返回结构化子图（节点/边/每边一条原文引用）。',
    parameters: {
      type: 'object',
      properties: {
        seed: { type: 'string', description: '实体名或别名' },
        direction: { type: 'string', enum: ['out', 'in', 'both'], description: '缺省 both；in = 反向影响（谁依赖它）' },
        hops: { type: 'number', description: '1..4，缺省 2' },
        relationTypes: { type: 'array', items: { type: 'string' }, description: '过滤边类型，如 ["calls","imports"]' },
        maxNodes: { type: 'number', description: '缺省 200，上限 500' },
        kb: { type: 'string', description: '可选：知识库名；缺省按工作区自动匹配（多库时必须指定）' },
      },
      required: ['seed'],
    },
    output: { schema: outputObject.schema, render: jsonRender },
    timeoutMs: 30_000,
    execute: async (args: unknown, exec: unknown) => {
      const caller = callerFrom(exec)
      try {
        const cwd = requireCallerCwd(caller)
        const a = args as Record<string, unknown>
        const seed = a['seed']
        if (typeof seed !== 'string' || seed.trim() === '') {
          throw new ToolRejection('invalid', 'seed 必须是非空字符串')
        }
        const direction = a['direction'] === 'out' || a['direction'] === 'in' ? a['direction'] : 'both'
        const hops = typeof a['hops'] === 'number' ? Math.min(Math.max(Math.trunc(a['hops']), 1), 4) : 2
        const maxNodes = typeof a['maxNodes'] === 'number' ? Math.min(Math.max(Math.trunc(a['maxNodes']), 1), 500) : undefined
        const relationTypes = Array.isArray(a['relationTypes'])
          ? a['relationTypes'].filter((t): t is string => typeof t === 'string')
          : undefined
        const sub = await resolve().traverse(kbRefOf(a), { seed: seed.slice(0, 200), direction, hops, relationTypes, maxNodes }, cwd)
        return { ok: true, value: sub }
      } catch (error) {
        return toolEnvelope(error)
      }
    },
  }

  const statusDef = {
    name: 'graphrag_status',
    description: '查看知识图谱索引状态：覆盖文件数、实体/关系/社区规模、最后索引时间、陈旧度、隔离区计数、模型可用性。不传 kb 时列出全部知识库概览。回答"图谱能不能信/要不要重建"的问题。',
    parameters: {
      type: 'object',
      properties: {
        kb: { type: 'string', description: '可选：知识库名；缺省列出全部知识库概览' },
      },
    },
    output: { schema: outputObject.schema, render: jsonRender },
    timeoutMs: 15_000,
    execute: async (args: unknown, exec: unknown) => {
      const caller = callerFrom(exec)
      try {
        requireCallerCwd(caller)
        const a = (args ?? {}) as Record<string, unknown>
        const status = await resolve().status(kbRefOf(a))
        return { ok: true, value: status }
      } catch (error) {
        return toolEnvelope(error)
      }
    },
  }

  const indexDef = {
    name: 'graphrag_index',
    description: '索引授权目录（或显式指定的已授权子路径）：分块 → LLM 实体关系抽取 → 社区摘要。增量执行，仅处理变更文件。触发 LLM 调用成本，需用户审批。',
    parameters: {
      type: 'object',
      properties: {
        kb: { type: 'string', description: '可选：知识库名；缺省按工作区自动匹配（多库时必须指定）' },
        create: { type: 'boolean', description: 'kb 不存在时新建该知识库（需同时给 roots），缺省 false' },
        roots: { type: 'array', items: { type: 'string' }, description: 'create=true 时为新建库的授权目录；否则为本次索引的已授权子路径' },
        retryQuarantined: { type: 'boolean', description: '同时重放隔离区，缺省 false' },
      },
    },
    output: { schema: outputObject.schema, render: jsonRender },
    timeoutMs: 600_000,
    execute: async (args: unknown, exec: unknown) => {
      const caller = callerFrom(exec)
      try {
        const cwd = requireCallerCwd(caller)
        const a = (args ?? {}) as Record<string, unknown>
        const roots = Array.isArray(a['roots']) ? a['roots'].filter((r): r is string => typeof r === 'string') : undefined
        const opts: IndexOptions = {
          roots,
          retryQuarantined: a['retryQuarantined'] === true,
        }
        const kbName = typeof a['kb'] === 'string' && a['kb'].trim() !== '' ? a['kb'].trim() : undefined
        if (kbName !== undefined && a['create'] === true && resolve().listKbs().every(k => k.name !== kbName)) {
          if (roots === undefined || roots.length === 0) {
            throw new ToolRejection('invalid', `新建知识库「${kbName}」需要提供 roots（授权目录）`)
          }
          resolve().createKb({ name: kbName, roots, description: '由 graphrag_index create 创建' })
        }
        const signal = (exec as { signal?: AbortSignal } | null)?.signal ?? new AbortController().signal
        const report = await resolve().index(kbRefOf(a) ?? {}, opts, signal)
        return { ok: true, value: report }
      } catch (error) {
        return toolEnvelope(error)
      }
    },
  }

  const forgetDef = {
    name: 'graphrag_forget',
    description: '从知识图谱移除数据：指定文件、指定实体、或整图重置。销毁性操作，级联删除关联 chunk/关系/摘要，需用户审批。',
    parameters: {
      type: 'object',
      properties: {
        kb: { type: 'string', description: '可选：知识库名；缺省按工作区自动匹配（多库时必须指定）' },
        target: {
          oneOf: [
            { type: 'object', properties: { kind: { const: 'file' }, path: { type: 'string' } }, required: ['kind', 'path'] },
            { type: 'object', properties: { kind: { const: 'entity' }, name: { type: 'string' } }, required: ['kind', 'name'] },
            { type: 'object', properties: { kind: { const: 'graph' } }, required: ['kind'] },
          ],
          description: '遗忘目标：file（按路径）/ entity（按名）/ graph（清空该库图谱）',
        },
      },
      required: ['target'],
    },
    output: { schema: outputObject.schema, render: jsonRender },
    timeoutMs: 60_000,
    execute: async (args: unknown, exec: unknown) => {
      const caller = callerFrom(exec)
      try {
        const cwd = requireCallerCwd(caller)
        const a = args as Record<string, unknown>
        const target = validateForgetTarget(a['target'])
        const report = await resolve().forget(kbRefOf(a), target, cwd)
        return { ok: true, value: report }
      } catch (error) {
        return toolEnvelope(error)
      }
    },
  }

  return [queryDef, graphDef, statusDef, indexDef, forgetDef]
}

function validateForgetTarget(raw: unknown): { kind: 'file'; path: string } | { kind: 'entity'; name: string } | { kind: 'graph' } {
  const t = raw as Record<string, unknown> | null | undefined
  if (t === null || typeof t !== 'object') throw new ToolRejection('invalid', 'target 必须是对象')
  if (t['kind'] === 'file' && typeof t['path'] === 'string' && t['path'] !== '') return { kind: 'file', path: t['path'] }
  if (t['kind'] === 'entity' && typeof t['name'] === 'string' && t['name'] !== '') return { kind: 'entity', name: t['name'] }
  if (t['kind'] === 'graph') return { kind: 'graph' }
  throw new ToolRejection('invalid', 'target 形状不合法：{kind:"file",path} | {kind:"entity",name} | {kind:"graph"}')
}

// ── 审批门（0204 §3；提取为纯函数便于单测）────────────────────────────────

export const MUTATING_TOOLS: ReadonlySet<string> = new Set(['graphrag_index', 'graphrag_forget'])

export interface ApprovalAsk {
  readonly reason: string
  readonly displayReason: { readonly en: string; readonly zh: string }
}

/** 一个 ask 决策（0.1.7 双面文案：reason 审计 / displayReason 本地化），或 undefined。 */
export function approvalDecision(
  exec: { readonly name: string; readonly arguments?: unknown; readonly signal: AbortSignal },
  mounted: boolean,
  estimate?: (target: KbRef | undefined, opts: IndexOptions, cwd?: string) => { readonly files: number; readonly estCalls: number },
): ({ readonly kind: 'ask' } & ApprovalAsk) | undefined {
  if (!mounted || exec.signal.aborted || !MUTATING_TOOLS.has(exec.name)) return undefined
  const caller = callerFrom(exec)
  if (exec.name === 'graphrag_index') {
    const a = (exec.arguments ?? {}) as Record<string, unknown>
    const opts: IndexOptions = {
      roots: Array.isArray(a['roots']) ? a['roots'].filter((r): r is string => typeof r === 'string') : undefined,
    }
    let detail = ''
    if (estimate !== undefined && caller.cwd !== undefined) {
      try {
        const a = (exec.arguments ?? {}) as Record<string, unknown>
        const est = estimate(kbRefOf(a), opts, caller.cwd)
        detail = est.files > 0
          ? `（约 ${est.estCalls} 次 LLM 调用，涉及 ${est.files} 个文件）`
          : '（当前无变更文件，预计零 LLM 调用）'
      } catch { /* 估算失败不阻塞审批，用通用文案 */ }
    }
    const en = `Run a GraphRAG index: chunk authorized files, extract entities/relations via LLM, rebuild communities. ${detail || 'LLM cost applies.'}`
    return {
      kind: 'ask',
      reason: `graphrag_index: incremental knowledge-graph indexing. ${detail || 'LLM cost applies.'}`,
      displayReason: {
        en,
        zh: `即将执行图谱索引：分块→LLM 抽取→社区摘要（增量，仅处理变更）。${detail}继续？`,
      },
    }
  }
  const t = (exec.arguments as Record<string, unknown> | undefined)?.['target'] as Record<string, unknown> | undefined
  const kind = typeof t?.['kind'] === 'string' ? t['kind'] : 'data'
  const what = kind === 'file' ? `file ${String(t?.['path'] ?? '')}`
    : kind === 'entity' ? `entity ${String(t?.['name'] ?? '')}`
    : kind === 'graph' ? 'the ENTIRE graph for this workspace'
    : 'the requested data'
  return {
    kind: 'ask',
    reason: `graphrag_forget: destroy ${what} (cascading).`,
    displayReason: {
      en: `This removes ${what} from the knowledge graph, cascading to related chunks/relations/summaries.`,
      zh: `即将从图谱移除 ${what === 'the ENTIRE graph for this workspace' ? '整个工作区图谱' : what}，级联删除关联数据。继续？`,
    },
  }
}

// ── 能力公告（0204 §4；单段有界，风格对齐 automation）──────────────────────

export const ANNOUNCEMENT = `本工作区已启用 dsh-kylin-vibe 插件（知识图谱检索）：把授权语料索引成实体-关系-社区图谱，供任务推理时做结构化检索。工具：graphrag_query（local=关系性问题 / global=全局架构问题）、graphrag_graph（多跳遍历，影响面分析 direction=in）、graphrag_status（覆盖与新鲜度）、graphrag_index（建图/增量更新，需审批）、graphrag_forget（遗忘，需审批）。三个非显然约束：① 引用结论必须落到返回 chunks 的原文位置（path+lines），communities 摘要是 LLM 二手信息仅供参考；② graphrag_status 显示陈旧度高时先 graphrag_index 增量更新再检索；③ 精确文本查找仍优先 grep/glob，图谱解决的是"关联/全局"类问题。`

// ── 插件入口 ─────────────────────────────────────────────────────────────────

export const name = 'dsh-kylin-vibe/tool'

/** seam（graphrag）+ 宿主服务面；seam 缺席时降级为不挂载（0205 §1）。 */
export const inject = ['graphrag', 'tools', 'systemPrompt', 'agents'] as const

export function apply(ctx: Context, config: ToolConfig = {}): void {
  const mounted = ctx as Context & { graphrag?: GraphRagService }
  const service = mounted.graphrag
  if (service === undefined) {
    ctx.logger?.warn('dsh-kylin-vibe/tool: seam 未挂载，工具面未安装')
    return
  }
  const services: ToolServices = { resolve: pin => service.resolve(pin ?? config.providerPin) as GraphRagProvider }
  const defs = graphragToolDefs(services, config)
  const agentTools = new Map<string, () => void>()
  const owned: Array<() => void> = []

  owned.push(ctx.systemPrompt!.section({ name: `plugin:${name}`, order: 210, text: ANNOUNCEMENT }))

  const mountTools = (agent: unknown): void => {
    const scoped = agent as { id?: unknown; session?: { id?: unknown }; ctx?: Context }
    const agentId = typeof scoped?.id === 'string' ? scoped.id : undefined
    const sessionId = typeof scoped?.session?.id === 'string' ? scoped.session.id : undefined
    if (agentId === undefined || sessionId === undefined || scoped.ctx === undefined) return
    if (!ctx.agents!.roots().some(root => (root as { id?: unknown }).id === agentId)) return
    if (agentTools.has(sessionId)) return
    const registered = scoped.ctx.effect(() => {
      const removers = defs.map(def => scoped.ctx!.tools!.register(def))
      return () => { for (const remove of [...removers].reverse()) void remove() }
    }, 'dsh-kylin-vibe: agent tools') as () => void
    // pre-execute 只能看到 caller.sessionId —— 键控必须用 sessionId
    // （agentId 与 sessionId 在不同宿主不保证相等）。
    agentTools.set(sessionId, registered)
  }

  for (const root of ctx.agents!.roots()) mountTools(root)
  owned.push(ctx.on('agent/created', (payload: unknown) => { mountTools((payload as { agent?: unknown })?.agent ?? payload) }))
  owned.push(ctx.on('agent/disposed', (payload: unknown) => {
    const agent = (payload as { agent?: { session?: { id?: string } } } | undefined)?.agent
      ?? (payload as { session?: { id?: string } } | undefined)
    const sessionId = agent?.session?.id
    if (typeof sessionId === 'string') agentTools.delete(sessionId)
  }))

  const estimateOf = (): ((target: KbRef | undefined, opts: IndexOptions, cwd?: string) => { files: number; estCalls: number }) | undefined => {
    try {
      const provider = service.resolve(config.providerPin) as GraphRagProvider
      return provider.estimate?.bind(provider)
    } catch {
      return undefined
    }
  }

  owned.push(ctx.on('tools/pre-execute', async (exec: unknown, next?: () => Promise<unknown>) => {
    const downstream = (await next?.()) as { kind: string } | undefined
    if (downstream === undefined) return { kind: 'allow' }
    if (downstream.kind !== 'allow') return downstream
    const caller = callerFrom(exec)
    const isMounted = caller.sessionId !== undefined && agentTools.has(caller.sessionId)
    const decision = approvalDecision(
      exec as { name: string; arguments?: unknown; signal: AbortSignal },
      isMounted,
      estimateOf(),
    )
    return decision ?? downstream
  }))

  ctx.effect(() => {
    return async () => {
      for (const dispose of [...agentTools.values()].reverse()) {
        try { dispose() } catch (error: unknown) {
          ctx.logger?.warn(`dsh-kylin-vibe: tool teardown failed: ${String(error)}`)
        }
      }
      agentTools.clear()
      for (const dispose of [...owned].reverse()) {
        try { dispose() } catch (error: unknown) {
          ctx.logger?.warn(`dsh-kylin-vibe: teardown failed: ${String(error)}`)
        }
      }
    }
  }, 'dsh-kylin-vibe: tool consumer lifecycle')
}

export type { EvidencePack, IndexReport, IndexStatus, Subgraph }
