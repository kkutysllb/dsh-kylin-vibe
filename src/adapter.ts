/** 宿主适配层（docs/02-design/0205 §1）：dsh 与 QiLin 的差异全部收敛于此。
 *
 * - resolveDataDir：GRAPHRAG_DATA_DIR → $DSH_HOME/graphrag → ~/.dsh/graphrag
 *   （QiLin 分支 M3 实测落定，0103 §4）
 * - callerFrom：exec 防御性解构（automation callerFrom 模式）
 * - llmCompleterOf：ctx.llm.stream → LlmCompleter（chunk 鸭子型防御读取、
 *   失败码路由、RATE_LIMIT 指数退避 ≤3）
 */

import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { Context } from '@deepseek-ai/cordis'

import type { LlmCompleter } from './core/extractor.ts'
import { GraphRagError } from './core/types.ts'

// ── 数据目录 ─────────────────────────────────────────────────────────────────

export function resolveDataDir(configured: string | undefined, env: NodeJS.ProcessEnv = process.env): string {
  if (configured !== undefined && configured !== '') return configured
  const fromEnv = env['GRAPHRAG_DATA_DIR']
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  const dshHome = env['DSH_HOME']
  if (dshHome !== undefined && dshHome !== '') return join(dshHome, 'graphrag')
  return join(homedir(), '.dsh', 'graphrag')
}

/** 工作区隔离：一个 cwd 一张图（0201 §4）。路径 hash 而非明文（0202 §7）。 */
export function workspaceDir(dataDir: string, cwd: string): string {
  const hash = createHash('sha256').update(cwd).digest('hex').slice(0, 16)
  return join(dataDir, 'workspaces', hash)
}

// ── 调用者身份 ───────────────────────────────────────────────────────────────

export interface ToolCaller {
  readonly cwd?: string | undefined
  readonly sessionId?: string | undefined
}

export function callerFrom(exec: unknown): ToolCaller {
  const agent = (exec as {
    agent?: { session?: { id?: unknown; header?: { cwd?: unknown } } } } | null | undefined
  )?.agent
  const id = agent?.session?.id
  const cwd = agent?.session?.header?.cwd
  const out: { sessionId?: string; cwd?: string } = {}
  if (typeof id === 'string') out.sessionId = id
  if (typeof cwd === 'string') out.cwd = cwd
  return out
}

// ── 能力探测 ─────────────────────────────────────────────────────────────────

export interface HostCapabilities {
  readonly llm: boolean
}

/** 非严格读取宿主 llm 服务（0.2.0 实测：未 inject 的服务属性访问会抛
 * "cannot get property without inject"，必须走 reflect.get(name, false)）。 */
export function llmServiceOf(ctx: Context): Context['llm'] | null {
  try {
    const viaReflect = ctx.reflect?.get?.('llm', false)
    if (viaReflect != null) return viaReflect as Context['llm']
    return ctx.llm ?? null
  } catch {
    return null
  }
}

export function capabilities(ctx: Context): HostCapabilities {
  return { llm: llmServiceOf(ctx) != null }
}

// ── 会话模型路由跟随（0.1.3：插件 model 配置缺省时跟随宿主当前选择）────────

export interface SessionRouteWatcher {
  /** 触发会话的当前路由；无会话上下文（面板触发）时回落最近一次见到的路由。 */
  routeFor(sessionId?: string): LlmRoute | null
}

/** 宿主 session/event 的 request/header 事件携带该会话请求头里的模型路由
 * （header.config.{provider, model}；kylin-memory 同款先例，真机验证过的形）。 */
export function routeFromSessionEvent(event: unknown): LlmRoute | null {
  const e = event as { type?: unknown; data?: { header?: { config?: { provider?: unknown; model?: unknown } } } } | null | undefined
  if (e === null || e === undefined || e.type !== 'request/header') return null
  const provider = e.data?.header?.config?.provider
  const model = e.data?.header?.config?.model
  return typeof provider === 'string' && provider !== '' && typeof model === 'string' && model !== ''
    ? { provider, model }
    : null
}

/** 监听宿主会话事件流记录模型路由：按会话各留最新一条，另留全局最新一条。
 * 纯观察者——事件面缺席/载荷形变/注册抛错一律静默降级（返回 null = 无跟随
 * 能力，抽取回落到显式配置或 NO_PROVIDER 指引），绝不影响宿主事件总线。 */
export function watchSessionRoutes(ctx: Context): SessionRouteWatcher | null {
  const on = (ctx as { on?: unknown } & Context).on
  if (typeof on !== 'function') return null
  const bySession = new Map<string, LlmRoute>()
  let latest: LlmRoute | null = null
  try {
    ;(on as (name: string, handler: (session: unknown, event: unknown) => void) => unknown).call(ctx, 'session/event', (session: unknown, event: unknown) => {
      try {
        const route = routeFromSessionEvent(event)
        if (route === null) return
        const id = (session as { id?: unknown } | null | undefined)?.id
        if (typeof id === 'string') bySession.set(id, route)
        latest = route
      } catch { /* 载荷形变：忽略本条 */ }
    })
  } catch {
    return null
  }
  return {
    routeFor(sessionId?: string): LlmRoute | null {
      if (sessionId !== undefined) {
        const r = bySession.get(sessionId)
        if (r !== undefined) return r
      }
      return latest
    },
  }
}

// ── ctx.llm → LlmCompleter ──────────────────────────────────────────────────

export interface LlmRoute {
  readonly provider: string
  readonly model: string
  readonly maxTokens?: number
}

export interface LlmRetryPolicy {
  readonly rateLimitRetries?: number
  readonly baseDelayMs?: number
}

const LATEX_BACKOFF = 2

/** 防御性读取一个流 chunk：文本增量或终止失败（鸭子型，见垫片注释）。 */
function chunkText(chunk: unknown): string | undefined {
  const c = chunk as { text?: unknown } | undefined
  return typeof c?.text === 'string' ? c.text : undefined
}
function chunkFailure(chunk: unknown): { code?: string; message?: string } | undefined {
  const c = chunk as { failure?: { code?: unknown; message?: unknown } } | undefined
  if (c?.failure === undefined || c.failure === null) return undefined
  const f = c.failure
  return {
    code: typeof f.code === 'string' ? f.code : undefined,
    message: typeof f.message === 'string' ? f.message : undefined,
  }
}

function mapLlmFailure(code: string | undefined, message: string | undefined): GraphRagError {
  if (code === 'MISSING_CREDENTIAL' || code === 'INVALID_CREDENTIAL') {
    return new GraphRagError('MISSING_CREDENTIAL', message ?? '宿主模型凭据缺失')
  }
  if (code === 'NO_ADAPTER') {
    return new GraphRagError('NO_PROVIDER', message ?? '宿主未配置模型 provider')
  }
  return new GraphRagError('NO_PROVIDER', message ?? `模型调用失败（${code ?? 'UNKNOWN'}）`)
}

// ── 流消费护栏（0.1.2 实测：无超时的辅助调用会被挂起的 API 流冻结整个
// 后台索引——AIDC 重索引 14 分钟零进度实证）。空闲超时（无增量）+ 总时长
// 超时双护栏；触发即 abort 底层请求并抛 LLM_TIMEOUT（extractChunk 归入
// LLM_ERROR → 文件级失败，ingest 继续下一文件）。

const STREAM_IDLE_MS = 90_000
const STREAM_TOTAL_MS = 300_000

/** 消费一个流：文本增量累积、失败码透传，带空闲/总时长护栏。 */
async function consumeStream(
  stream: AsyncIterable<unknown>,
  opts: { readonly idleMs: number; readonly totalMs: number; readonly onTimeout?: () => void },
): Promise<{ text: string; failure?: { code?: string; message?: string } }> {
  const iter = stream[Symbol.asyncIterator]()
  const deadline = Date.now() + opts.totalMs
  let text = ''
  let failure: { code?: string; message?: string } | undefined
  for (;;) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      opts.onTimeout?.()
      throw new GraphRagError('LLM_TIMEOUT', `LLM 流总时长超过 ${Math.round(opts.totalMs / 1000)}s`)
    }
    let idle: ReturnType<typeof setTimeout> | undefined
    const idleRace = new Promise<never>((_, reject) => {
      idle = setTimeout(
        () => reject(new GraphRagError('LLM_TIMEOUT', `LLM 流空闲超过 ${Math.round(opts.idleMs / 1000)}s`)),
        Math.min(opts.idleMs, remaining),
      )
    })
    try {
      const next = (await Promise.race([iter.next(), idleRace])) as IteratorResult<unknown>
      if (next.done) return { text, failure }
      const chunk = next.value
      const t = chunkText(chunk)
      if (t !== undefined) { text += t; continue }
      const f = chunkFailure(chunk)
      if (f !== undefined) failure = f
    } catch (err) {
      opts.onTimeout?.()
      throw err
    } finally {
      if (idle !== undefined) clearTimeout(idle)
    }
  }
}

/** 组合外部 signal 与内部超时 abort。 */
function linkedSignal(signal: AbortSignal | undefined): { readonly signal: AbortSignal; readonly abort: () => void } {
  const ac = new AbortController()
  const onOuter = (): void => ac.abort()
  if (signal !== undefined) {
    if (signal.aborted) ac.abort()
    else signal.addEventListener('abort', onOuter, { once: true })
  }
  return { signal: ac.signal, abort: () => { ac.abort(); signal?.removeEventListener('abort', onOuter) } }
}

/** 把 ctx.llm.stream 包成核心库的 LlmCompleter。RATE_LIMIT 指数退避重试
 * ≤ rateLimitRetries（默认 3，0203 §1.5：llm-retry 挂在 agent 步骤，
 * 不覆盖辅助调用，插件自管）。 */
export function llmCompleterOf(
  ctx: Context,
  route: LlmRoute,
  policy: LlmRetryPolicy = {},
): LlmCompleter {
  const maxRetries = policy.rateLimitRetries ?? 3
  const baseDelay = policy.baseDelayMs ?? 500
  // 服务实例在创建期一次性解析（llmServiceOf 走 reflect.get 非严格读取）；
  // 调用期不得再触碰 ctx.llm 属性——未 inject 的属性访问在宿主上会抛错
  // （0.2.0 实测，面板触发索引时暴露）。
  const llmService = llmServiceOf(ctx)
  if (llmService === null || llmService === undefined) {
    throw new GraphRagError('NO_PROVIDER', '宿主 llm 服务不可用')
  }

  return {
    complete: async (system, user, signal) => {
      let lastRateLimitMessage = ''
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) throw new GraphRagError('ABORTED', '已中止')
        const linked = linkedSignal(signal)
        const stream = llmService.stream({
          provider: route.provider,
          model: route.model,
          maxTokens: route.maxTokens,
          messages: [
            { role: 'system', content: [{ type: 'text', text: system }] },
            { role: 'user', content: [{ type: 'text', text: user }] },
          ],
          signal: linked.signal,
        })
        const { out, failure } = await consumeStream(stream, {
          idleMs: STREAM_IDLE_MS, totalMs: STREAM_TOTAL_MS, onTimeout: linked.abort,
        }).then(
          r => ({ out: r.text, failure: r.failure }),
          err => { linked.abort(); throw err },
        )
        if (failure === undefined) return out
        if (failure.code === 'RATE_LIMIT' && attempt < maxRetries) {
          lastRateLimitMessage = failure.message ?? ''
          const delay = baseDelay * Math.pow(LATEX_BACKOFF, attempt)
          await new Promise<void>(resolve => setTimeout(resolve, delay))
          continue
        }
        throw mapLlmFailure(failure.code, failure.message)
      }
      throw new GraphRagError('NO_PROVIDER', `RATE_LIMIT 重试耗尽：${lastRateLimitMessage}`)
    },
  }
}

/** 图片附件的最小形状（核心层不感知附件服务契约，这里只做透明传递）。 */
export type VisionRef = unknown

export interface VisionDeps {
  readonly attachments: {
    saveImages(inputs: readonly { data: Uint8Array; mediaType: string; name?: string }[]): Promise<readonly unknown[]>
  }
  readonly llm: NonNullable<ReturnType<typeof llmServiceOf>>
}

/** 宿主视觉链路 → 核心库 VisionCompleter：
 * 图片经 attachments.saveImages 成为持久引用（ImageAttachmentRef），
 * llm stream 以 `{type:'image', attachment}` 内容块随 user 消息发送
 * （pi-ai/deepseek 路线原生支持；模型需具备 image 输入能力）。
 * 附件服务缺席返回 null——ingest 据此降级（failed/vision-unavailable）。 */
export function visionCompleterOf(ctx: Context, route: LlmRoute, policy: LlmRetryPolicy = {}): (import('./core/extractor.ts').VisionCompleter) | null {
  const maxRetries = policy.rateLimitRetries ?? 1
  const baseDelay = policy.baseDelayMs ?? 500
  // 创建期一次性解析（同 llmCompleterOf 纪律）：附件与 llm 服务缺席 → null
  let attachments: VisionDeps['attachments'] | null = null
  try {
    attachments = (ctx.reflect?.get?.('attachments', false) ?? null) as VisionDeps['attachments'] | null
  } catch {
    attachments = null
  }
  const llm = llmServiceOf(ctx)
  if (attachments === null || attachments === undefined || llm === null || llm === undefined) return null
  const llmSvc: NonNullable<typeof llm> = llm

  const streamOnce = async (system: string, user: string, ref: unknown, signal?: AbortSignal): Promise<string> => {
    const linked = linkedSignal(signal)
    const stream = llmSvc.stream({
      provider: route.provider,
      model: route.model,
      maxTokens: route.maxTokens,
      messages: [
        { role: 'system', content: [{ type: 'text', text: system }] },
        { role: 'user', content: [
          { type: 'text', text: user },
          { type: 'image', attachment: ref },
        ] },
      ],
      signal: linked.signal,
    })
    const { text: out, failure } = await consumeStream(stream, {
      idleMs: STREAM_IDLE_MS, totalMs: STREAM_TOTAL_MS, onTimeout: linked.abort,
    }).catch(err => { linked.abort(); throw err })
    if (failure === undefined) return out
    if (failure.code === 'RATE_LIMIT' && maxRetries > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, baseDelay))
      return streamOnce(system, user, ref, signal)
    }
    throw mapLlmFailure(failure.code, failure.message)
  }

  return {
    save: async ({ data, mime, name }) => {
      const refs = await attachments!.saveImages([{ data, mediaType: mime, name }])
      return refs[0]
    },
    complete: (system, user, ref, signal) => streamOnce(system, user, ref, signal),
  }
}
