/** JSON 契约（与主机 RPC 通道 `/dsh-kylin-vibe` 对应）。自包含：不 import
 * 任何宿主模块，client bundle 保持零宿主依赖。
 */

export interface KbView {
  readonly id: string
  readonly name: string
  readonly roots: readonly string[]
  readonly description: string | null
  readonly managed: 'user' | 'config'
  readonly createdAt: number
  readonly lastIndexedAt: number | null
  readonly filesIndexed: number
  readonly stale: number
  readonly entities: number
  readonly relations: number
  readonly communities: number
  readonly progress: ProgressView | null
}

export interface ProgressView {
  readonly kbId: string
  readonly kbName: string
  readonly phase: 'scanning' | 'extracting' | 'communities' | 'summarizing' | 'done' | 'error'
  readonly filesDone: number
  readonly filesTotal: number
  readonly currentFile: string | null
  readonly llmCalls: number
  readonly tokensIn: number
  readonly tokensOut: number
  readonly quarantined: number
  readonly startedAt: number
  readonly finishedAt: number | null
  readonly error: string | null
}

export interface Snapshot {
  readonly kbs: readonly KbView[]
}

export interface CreateKbInput {
  readonly name: string
  readonly roots: readonly string[]
  readonly description?: string
}

export interface UpdateKbInput {
  readonly id: string
  readonly name?: string
  readonly roots?: readonly string[]
  readonly description?: string
}

export interface ClientRpc {
  call(channel: string, endpoint: string, payload: unknown): Promise<unknown>
}

export interface RpcFailure {
  readonly code: string
  readonly message: string
}

/** 解包主机 RPC 信封：{ok,value} / {ok,error}。 */
export async function unwrap<T>(promise: Promise<unknown>): Promise<T> {
  const raw = await promise as { ok?: unknown; value?: unknown; error?: { code?: unknown; message?: unknown } }
  if (raw?.ok === true) return raw.value as T
  const code = typeof raw?.error?.code === 'string' ? raw.error.code : 'unknown'
  const message = typeof raw?.error?.message === 'string' ? raw.error.message : String(raw?.error?.code ?? 'unknown')
  throw Object.assign(new Error(message), { code })
}
