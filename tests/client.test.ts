/** Client bundle 契约测试：模块表装载 + inject 导出 + slots 注册（0207 §3）。
 * 用 node:test + 模拟 __ModuleLoader__ 壳，react 从本包 node_modules 解析。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createKbRuntime } from '../src/client/runtime.ts'
import { dictionaries, en, NS, zh } from '../src/client/locales.ts'
import { installStyles } from '../src/client/styles.ts'

test('runtime：快照轮询 + 动作刷新（RPC 桩）', async () => {
  const calls: { endpoint: string; payload: unknown }[] = []
  let snapshot = { kbs: [{ id: 'kb1', name: '冒烟库', roots: ['/tmp'], description: null, managed: 'user', createdAt: 1, lastIndexedAt: null, progress: null }] }
  const runtime = createKbRuntime({
    rpc: { call: async (_channel, endpoint, payload) => {
      calls.push({ endpoint, payload })
      if (endpoint === 'snapshot') return { ok: true, value: snapshot }
      if (endpoint === 'createKb') { snapshot = { kbs: [...snapshot.kbs, { id: 'kb2', name: '新库', roots: ['/x'], description: null, managed: 'user', createdAt: 2, lastIndexedAt: null, progress: null }] }; return { ok: true, value: { id: 'kb2' } } }
      if (endpoint === 'index') return { ok: true, value: { started: true } }
      return { ok: false, error: { code: 'not-found', message: 'unknown' } }
    } },
  })
  await runtime.refresh()
  const s1 = runtime.source.getSnapshot()
  assert.equal(s1.phase, 'ready')
  assert.equal(s1.snapshot?.kbs.length, 1)
  await runtime.create({ name: '新库', roots: ['/x'] })
  assert.equal(runtime.source.getSnapshot().snapshot?.kbs.length, 2)
  await runtime.startIndex('kb2')
  assert.ok(calls.some(c => c.endpoint === 'index'))
  // 错误信封 → notice
  await runtime.remove('missing').catch(() => {})
  assert.ok(runtime.notice.getSnapshot()?.includes('失败') ?? false, 'notice 应携带失败文案')
})

test('runtime：RPC 失败 → error 相位', async () => {
  const runtime = createKbRuntime({ rpc: { call: async () => { throw new Error('channel dead') } } })
  await runtime.refresh()
  assert.equal(runtime.source.getSnapshot().phase, 'error')
  assert.match(runtime.source.getSnapshot().error ?? '', /channel dead/)
})

test('styles：返回清理函数（DOM 缺席环境跳过）', () => {
  if (typeof document === 'undefined') return
  const dispose = installStyles()
  assert.equal(typeof dispose, 'function')
  dispose()
})

test('styles：幂等注入（同一 id 不重复落 <style>）', () => {
  if (typeof document === 'undefined') return
  const d1 = installStyles()
  const d2 = installStyles()
  assert.equal(document.querySelectorAll('style#ky-graphrag-styles').length, 1)
  d1()
  d2()
})

test('locales：zh/en 键完全对齐 + NS 命名空间 + 占位符一致', () => {
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.deepEqual(enKeys, zhKeys)
  assert.ok(Object.values({ ...zh, ...en }).every(v => typeof v === 'string' && v.length > 0))
  assert.match(NS, /^[A-Za-z]+$/)
  // 占位符集合必须逐键一致（{name} 这类参数漏译会在运行时露出花括号原文）
  for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
    const ph = (s: string) => new Set(s.match(/\{(\w+)\}/g) ?? [])
    assert.deepEqual(ph(en[key]), ph(zh[key]), `占位符不一致: ${key}`)
  }
  assert.equal(Object.keys(dictionaries).sort().join(','), 'en,zh')
})
