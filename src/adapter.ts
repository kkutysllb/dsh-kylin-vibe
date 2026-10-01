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
  const sysTemplate = (system: string): string => system

  return {
    complete: async (system, user, signal) => {
      let lastRateLimitMessage = ''
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) throw new GraphRagError('ABORTED', '已中止')
        const stream = ctx.llm!.stream({
          provider: route.provider,
          model: route.model,
          maxTokens: route.maxTokens,
          messages: [
            { role: 'system', content: [{ type: 'text', text: sysTemplate(system) }] },
            { role: 'user', content: [{ type: 'text', text: user }] },
          ],
          signal,
        })
        let out = ''
        let failure: { code?: string; message?: string } | undefined
        for await (const chunk of stream) {
          const text = chunkText(chunk)
          if (text !== undefined) { out += text; continue }
          const f = chunkFailure(chunk)
          if (f !== undefined) failure = f
        }
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
