/** RPC 通道注册回归测试（0.1.5：热安装不得依赖 apply 时的 provider 顺序）。
 *
 * 背景（用户上报）：插件在运行中的 profile 热安装后，面板报
 * `transport failure for /dsh-kylin-vibe/snapshot: HTTP 405`，必须重启宿主
 * 才恢复。根因：rpc 行在 apply 时一次性 resolve provider，热装时 provider 行
 * 与 rpc 行同批启动、顺序不保证，provider 尚未注册就永久放弃注册路由——请求
 * 落到 SPA fallback（GET/HEAD 之外一律 405）。修复：路由无条件注册，provider
 * 每次请求惰性解析。
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Context } from '@deepseek-ai/cordis'

import { GraphRagServiceImpl, type GraphRagProvider } from '../src/index.ts'
import { apply, handleKbRpc, RPC_CHANNEL } from '../src/rpc.ts'

// ── 宿主桩：webServer.register 捕获路由，connection 围栏放行 ────────────────

interface Route {
  readonly kind: string
  readonly path: string
  readonly handler: (req: unknown, res: unknown) => void
}

interface HostStub {
  readonly ctx: Context
  readonly routes: Route[]
}

function hostStub(service: GraphRagServiceImpl): HostStub {
  const routes: Route[] = []
  const ctx = {
    effect(fn: () => unknown): () => void {
      const value = fn()
      return typeof value === 'function' ? value as () => void : () => {}
    },
    logger: { warn: (_message: string) => {} },
    graphrag: service,
    connection: { requestRejection: () => undefined },
    webServer: {
      register(route: Route): () => void {
        routes.push(route)
        return () => {
          const at = routes.indexOf(route)
          if (at !== -1) routes.splice(at, 1)
        }
      },
    },
  }
  return { ctx: ctx as unknown as Context, routes }
}

function fakeProvider(): GraphRagProvider {
  return {
    id: 'fake',
    listKbs: () => [],
  } as unknown as GraphRagProvider
}

// ── HTTP 桩 ─────────────────────────────────────────────────────────────────

interface FakeResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  writableEnded: boolean
  writeHead(status: number, headers?: Record<string, string>): FakeResponse
  end(chunk?: string): void
  on(): FakeResponse
  destroy(): void
}

function request(method: string, path: string, body?: unknown): unknown {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  return {
    method,
    url: path,
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

function response(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 0,
    headers: {},
    body: '',
    writableEnded: false,
    writeHead(status: number, headers?: Record<string, string>): FakeResponse {
      res.statusCode = status
      Object.assign(res.headers, headers ?? {})
      return res
    },
    end(chunk?: string): void {
      if (chunk !== undefined) res.body += chunk
      res.writableEnded = true
    },
    on(): FakeResponse { return res },
    destroy(): void { res.writableEnded = true },
  }
  return res
}

/** 等 handler 把响应写完（serveRpcRequest 是 void 启动的异步函数）。 */
async function settle(res: FakeResponse): Promise<void> {
  for (let i = 0; i < 200 && !res.writableEnded; i++) {
    await new Promise(resolve => { setTimeout(resolve, 1) })
  }
}

function envelope(method: string, payload: unknown = {}): unknown {
  return { type: 'client-request', rpcId: 'test-1', method, payload }
}

// ── 用例 ────────────────────────────────────────────────────────────────────

describe('rpc channel registration', () => {
  test('热安装序：provider 尚未注册时 apply 仍注册路由（旧实现返回 405 的根因）', async () => {
    const service = new GraphRagServiceImpl()
    const host = hostStub(service)

    apply(host.ctx)

    const route = host.routes.find(entry => entry.path === RPC_CHANNEL)
    assert.ok(route, 'apply 必须无条件注册 /dsh-kylin-vibe 路由')
    assert.equal(route.kind, 'prefix')

    // provider 行稍后 apply：路由已在，请求随即可用（面板轮询下轮即恢复）。
    service.register(fakeProvider())
    const res = response()
    route.handler(request('POST', `${RPC_CHANNEL}/snapshot`, envelope('snapshot')), res as unknown as never)
    await settle(res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(JSON.parse(res.body), {
      type: 'server-response',
      rpcId: 'test-1',
      result: { ok: true, value: { kbs: [] } },
    })
  })

  test('provider 暂缺时返回 NO_PROVIDER 结果信封，而不是传输层失败', async () => {
    const service = new GraphRagServiceImpl()
    const host = hostStub(service)
    apply(host.ctx)

    const result = await handleKbRpc(pin => service.resolve(pin), 'snapshot', {}, new AbortController().signal)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, 'NO_PROVIDER')
  })

  test('provider 已注册时行为不变：snapshot 走真实路由', async () => {
    const service = new GraphRagServiceImpl()
    service.register(fakeProvider())
    const host = hostStub(service)
    apply(host.ctx)

    const route = host.routes.find(entry => entry.path === RPC_CHANNEL)
    assert.ok(route)
    const res = response()
    route.handler(request('POST', `${RPC_CHANNEL}/snapshot`, envelope('snapshot')), res as unknown as never)
    await settle(res)

    assert.equal(res.statusCode, 200)
    const payload = JSON.parse(res.body) as { result: { ok: boolean } }
    assert.equal(payload.result.ok, true)
  })

  test('非 POST 仍是 405（围栏契约不变）', async () => {
    const service = new GraphRagServiceImpl()
    service.register(fakeProvider())
    const host = hostStub(service)
    apply(host.ctx)

    const route = host.routes.find(entry => entry.path === RPC_CHANNEL)
    assert.ok(route)
    const res = response()
    route.handler(request('GET', `${RPC_CHANNEL}/snapshot`), res as unknown as never)
    await settle(res)
    assert.equal(res.statusCode, 405)
  })
})
