/** Web 面板 RPC 通道（docs/02-design/0207 §3）：`/dsh-kylin-vibe` 前缀注册在
 * 宿主 webServer 上，复用 connection 的 Host/Origin + 浏览器鉴权围栏。
 * 端点：snapshot / createKb / updateKb / deleteKb / index / cancel / progress。
 * 面板触发的 index 走后台执行（indexBackground），进度经 progress 轮询。
 */

import type { Context } from '@deepseek-ai/cordis'

import { GraphRagError, type IndexProgress } from './core/types.ts'
import type { GraphRagProvider } from './index.ts'

export const RPC_CHANNEL = '/dsh-kylin-vibe'

export type RpcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

const MAX_STRING = 4_000
const RPC_BODY_LIMIT_BYTES = 1 * 1024 * 1024

function ok<T>(value: T): RpcResult<T> {
  return { ok: true, value }
}

function fail(code: string, message: string): RpcResult<never> {
  return { ok: false, error: { code, message } }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GraphRagError('INVALID', `${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string, max = MAX_STRING): string {
  if (typeof value !== 'string') throw new GraphRagError('INVALID', `${label} must be a string`)
  if (value.length > max) throw new GraphRagError('INVALID', `${label} exceeds ${max} chars`)
  return value
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : string(value, label)
}

function stringArray(value: unknown, label: string, max = 64): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new GraphRagError('INVALID', `${label} must be an array`)
  if (value.length > max) throw new GraphRagError('INVALID', `${label} exceeds ${max} items`)
  return value.map(item => string(item, label, MAX_STRING))
}

function bool(value: unknown, fallback: boolean): boolean {
  return value === undefined ? fallback : value === true
}

function toErrorResult(error: unknown): RpcResult<never> {
  if (error instanceof GraphRagError) return fail(error.code, error.message)
  return fail('internal', error instanceof Error ? error.message : String(error))
}

/** 注册 `/dsh-kylin-vibe` 通道（webServer 前缀路由 + connection 鉴权围栏）。 */
export function registerKbRpc(ctx: Context, resolve: (pin?: string) => GraphRagProvider): () => void {
  return ctx.effect(() => (ctx as unknown as {
    webServer?: { register(route: unknown): unknown }
  }).webServer!.register({
    kind: 'prefix',
    path: RPC_CHANNEL,
    handler: (req: unknown, res: unknown): void => { void serveRpcRequest(ctx, resolve, req as never, res as never) },
  }), 'dsh-kylin-vibe: rpc channel') as unknown as () => void
}

async function serveRpcRequest(
  ctx: Context,
  resolve: (pin?: string) => GraphRagProvider,
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
): Promise<void> {
  const reply = (status: number, payload: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json', connection: 'close' })
    res.end(JSON.stringify(payload))
  }
  const connection = (ctx as unknown as {
    connection?: { requestRejection?(r: unknown): number | undefined }
  }).connection
  const rejection = connection?.requestRejection?.(req)
  if (rejection !== undefined) {
    res.writeHead(rejection)
    res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'text/plain' })
    res.end('method not allowed')
    return
  }
  const url = new URL(req.url ?? '/', 'http://dsh.internal')
  const endpoint = url.pathname === RPC_CHANNEL ? '' : url.pathname.startsWith(`${RPC_CHANNEL}/`)
    ? url.pathname.slice(RPC_CHANNEL.length + 1)
    : undefined
  if (endpoint === undefined || !/^[A-Za-z0-9_$.:-]+$/.test(endpoint)) {
    reply(404, { type: 'server-response', rpcId: 'invalid-request', result: fail('not-found', 'unknown endpoint') })
    return
  }
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    reply(415, { type: 'server-response', rpcId: 'invalid-request', result: fail('INVALID', 'content type must be application/json') })
    return
  }
  const declared = req.headers['content-length']
  if (declared !== undefined && Number(declared) > RPC_BODY_LIMIT_BYTES) {
    res.writeHead(413, { connection: 'close' })
    res.end()
    return
  }
  let raw = ''
  const abort = new AbortController()
  res.on('close', () => { if (!res.writableEnded) abort.abort() })
  try {
    let received = 0
    for await (const chunk of req) {
      received += (chunk as Buffer).byteLength
      if (received > RPC_BODY_LIMIT_BYTES) throw new Error('body too large')
      raw += String(chunk)
    }
  } catch {
    res.writeHead(400, { connection: 'close' })
    res.end('body read failure')
    req.destroy()
    return
  }
  let envelope: { type?: unknown; rpcId?: unknown; method?: unknown; payload?: unknown }
  try {
    envelope = JSON.parse(raw) as typeof envelope
  } catch {
    reply(400, { type: 'server-response', rpcId: 'invalid-request', result: fail('INVALID', 'body is not JSON') })
    return
  }
  if (envelope?.type !== 'client-request' || typeof envelope.rpcId !== 'string' || typeof envelope.method !== 'string') {
    reply(200, {
      type: 'server-response',
      rpcId: typeof envelope?.rpcId === 'string' ? envelope.rpcId : 'invalid-request',
      result: fail('INVALID', 'invalid client-request message'),
    })
    return
  }
  if (envelope.method !== endpoint) {
    reply(200, { type: 'server-response', rpcId: envelope.rpcId, result: fail('INVALID', 'method does not match endpoint') })
    return
  }
  const result = await handleKbRpc(resolve, envelope.method, envelope.payload, abort.signal)
  reply(200, { type: 'server-response', rpcId: envelope.rpcId, result })
}

/** 端点分发（纯派发，导出供单测）。 */
export async function handleKbRpc(
  resolve: (pin?: string) => GraphRagProvider,
  endpoint: string,
  payload: unknown,
  _signal: AbortSignal,
): Promise<RpcResult<unknown>> {
  try {
    const provider = resolve()
    const body = payload === undefined ? {} : record(payload, 'payload')
    switch (endpoint) {
      case 'snapshot': {
        const kbs = provider.listKbs()
        const withStats = await Promise.all(kbs.map(async kb => {
          const status = await provider.status({ id: kb.id })
          return {
            ...kb,
            filesIndexed: status.files.indexed,
            stale: status.files.stale,
            entities: status.graph.entities,
            relations: status.graph.relations,
            communities: status.graph.communities,
            progress: provider.progress(kb.id),
          }
        }))
        return ok({ kbs: withStats })
      }
      case 'createKb': {
        const name = string(body['name'], 'name', 120)
        const roots = stringArray(body['roots'], 'roots', 16)
        const description = optionalString(body['description'], 'description')
        if (roots.length === 0) return fail('INVALID', 'roots 不能为空')
        return ok(provider.createKb({ name, roots, description }))
      }
      case 'updateKb': {
        const id = string(body['id'], 'id', 120)
        const name = optionalString(body['name'], 'name')
        const roots = body['roots'] === undefined ? undefined : stringArray(body['roots'], 'roots', 16)
        const description = body['description'] === undefined ? undefined : optionalString(body['description'], 'description')
        return ok(provider.updateKb(id, { name, roots, description }))
      }
      case 'deleteKb': {
        const id = string(body['id'], 'id', 120)
        return ok(await provider.deleteKb(id))
      }
      case 'index': {
        const id = string(body['id'], 'id', 120)
        const retryQuarantined = bool(body['retryQuarantined'], false)
        return ok(provider.indexBackground({ id }, { retryQuarantined }))
      }
      case 'cancel': {
        const id = string(body['id'], 'id', 120)
        return ok({ cancelled: provider.cancelIndex(id) })
      }
      case 'progress': {
        const id = string(body['id'], 'id', 120)
        const progress: IndexProgress | null = provider.progress(id)
        return ok({ progress })
      }
      case 'browse': {
        const id = string(body['id'], 'id', 120)
        const query = optionalString(body['query'], 'query') ?? ''
        const limit = Math.min(Math.max(Number(body['limit'] ?? 30) || 30, 1), 100)
        return ok(provider.browseEntities({ id }, query, limit))
      }
      case 'sampleReview': {
        const id = string(body['id'], 'id', 120)
        const limit = Math.min(Math.max(Number(body['limit'] ?? 20) || 20, 1), 50)
        return ok(provider.sampleForReview({ id }, limit))
      }
      case 'sources': {
        const id = string(body['id'], 'id', 120)
        return ok(provider.listKnowledge({ id }))
      }
      case 'forgetFile': {
        const id = string(body['id'], 'id', 120)
        const path = string(body['path'], 'path', 400)
        return ok(await provider.forgetKnowledge({ id }, path))
      }
      case 'reindexSource': {
        const id = string(body['id'], 'id', 120)
        const path = string(body['path'], 'path', 400)
        return ok(provider.reindexKnowledge({ id }, path))
      }
      case 'setSourceEnabled': {
        const id = string(body['id'], 'id', 120)
        const path = string(body['path'], 'path', 400)
        const enabled = body['enabled'] === true
        return ok(provider.setKnowledgeEnabled({ id }, path, enabled))
      }
      case 'importFiles': {
        const id = string(body['id'], 'id', 120)
        const dir = string(body['dir'], 'dir', 500)
        if (!dir.startsWith('/')) return fail('INVALID', 'dir must be an absolute path')
        return ok(provider.importDirectory({ id }, dir))
      }
      case 'changes': {
        const id = string(body['id'], 'id', 120)
        return ok(provider.changesPreview({ id }))
      }
      case 'recall': {
        const id = string(body['id'], 'id', 120)
        const question = string(body['question'], 'question', 2000)
        const topK = Math.min(Math.max(Number(body['topK'] ?? 12) || 12, 5), 50)
        return ok(await provider.query({ id }, { question, mode: 'local', topK }))
      }
      case 'addText': {
        const id = string(body['id'], 'id', 120)
        const title = string(body['title'], 'title', 120)
        const text = string(body['text'], 'text', 50000)
        if (text.trim() === '') return fail('INVALID', 'text must not be empty')
        return ok(provider.addTextKnowledge({ id }, title, text))
      }
      case 'correctFromSelection': {
        const text = string(body['text'], 'text', 2000)
        return ok(await provider.correctFromSelection(typeof body['id'] === 'string' ? { id: body['id'] } : undefined, text))
      }
      case 'review': {
        const id = string(body['id'], 'id', 120)
        const relationId = Number(body['relationId'])
        if (!Number.isSafeInteger(relationId) || relationId <= 0) return fail('INVALID', 'relationId must be a positive integer')
        const verdict = body['verdict']
        if (verdict !== 'correct' && verdict !== 'wrong' && verdict !== 'unsure') return fail('INVALID', 'verdict must be correct|wrong|unsure')
        let correction: { s?: string; r?: string; o?: string } | undefined
        const raw = body['correction']
        if (typeof raw === 'object' && raw !== null) {
          const c = raw as Record<string, unknown>
          correction = {
            s: typeof c['s'] === 'string' ? c['s'].slice(0, 200) : undefined,
            r: typeof c['r'] === 'string' ? c['r'].slice(0, 120) : undefined,
            o: typeof c['o'] === 'string' ? c['o'].slice(0, 200) : undefined,
          }
        }
        return ok(provider.reviewRelation({ id }, relationId, verdict, correction))
      }
      case 'health': {
        const id = string(body['id'], 'id', 120)
        return ok(provider.healthReport({ id }))
      }
      default:
        return fail('not-found', `unknown endpoint: ${endpoint}`)
    }
  } catch (error) {
    return toErrorResult(error)
  }
}

// ── 插件入口：独立行注册（headless 无 webServer 时该行 pending，不影响工具面）──

export const name = 'dsh-kylin-vibe/rpc'

export const inject = ['graphrag', 'webServer', 'connection'] as const

export function apply(ctx: Context): void {
  const mounted = ctx as Context & { graphrag?: import('./index.ts').GraphRagService }
  const service = mounted.graphrag
  if (service === undefined) {
    ctx.logger?.warn('dsh-kylin-vibe/rpc: seam 未挂载，RPC 通道未注册')
    return
  }
  let provider: GraphRagProvider
  try {
    provider = service.resolve() as GraphRagProvider
  } catch (error) {
    ctx.logger?.warn(`dsh-kylin-vibe/rpc: provider 不可用，RPC 通道未注册: ${String(error)}`)
    return
  }
  ctx.effect(() => registerKbRpc(ctx, () => provider), 'dsh-kylin-vibe: rpc registration')
}
