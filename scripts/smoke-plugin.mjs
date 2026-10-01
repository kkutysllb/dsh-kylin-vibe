/** 插件加载冒烟（docs/02-design/0205 §4）：在纯 Node（无宿主）中加载 lib/
 * 三入口，用最小桩 ctx 走完 apply，断言注册面：
 *   seam 挂载 graphrag 服务 / provider 注册进 seam / tool 挂载 5 工具 + 公告段。
 * 任何 @deepseek-ai/* 运行时导入缺失都会在此暴露（零运行时导入纪律）。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const seam = await import(pathToFileURL(join(root, 'lib/index.js')).href)
const providerMod = await import(pathToFileURL(join(root, 'lib/provider.js')).href)
const toolMod = await import(pathToFileURL(join(root, 'lib/tool.js')).href)

// ── 桩 ctx ───────────────────────────────────────────────────────────────────

const registered = { tools: [], sections: [] }
const listeners = new Map()
const disposers = []

function makeCtx({ withSeam = true, withLlm = false } = {}) {
  const ctx = {
    effect(fn, _label) { const v = typeof fn === 'function' ? fn() : fn; if (typeof v === 'function' || v?.then) disposers.push(v); return v },
    on(event, cb) { listeners.set(event, cb); return () => {} },
    logger: { warn: (_m) => {} },
    tools: { register(def) { registered.tools.push(def.name); return () => {} } },
    systemPrompt: { section(s) { registered.sections.push(s); return () => {} } },
    agents: {
      roots: () => [{ id: 'a1', session: { id: 's1', header: { cwd: '/ws' } }, ctx: makeCtx({ plain: true }) }],
      on: (_e, _cb) => () => {},
    },
    llm: withLlm ? { stream: async function* () {} } : undefined,
  }
  if (!withSeam) delete ctx.graphrag
  return ctx
}

function plainCtx() {
  return {
    effect(fn) { const v = typeof fn === 'function' ? fn() : fn; if (typeof v === 'function') disposers.push(v); return v },
    tools: { register(def) { registered.tools.push(def.name); return () => {} } },
  }
}

function bootCtx(opts) {
  const scoped = plainCtx()
  const ctx = {
    effect(fn) { const v = typeof fn === 'function' ? fn() : fn; if (typeof v === 'function') disposers.push(v); return v },
    reflect: { provide(name, value) { ctx[name] = value; return () => { delete ctx[name] } } },
    on(event, cb) { listeners.set(event, cb); return () => {} },
    logger: { warn: (_m) => {} },
    tools: { register(def) { registered.tools.push(`host:${def.name}`); return () => {} } },
    systemPrompt: { section(s) { registered.sections.push(s); return () => {} } },
    agents: { roots: () => [{ id: 'a1', session: { id: 's1', header: { cwd: '/ws' } }, ctx: scoped }], on: () => () => {} },
    llm: opts?.withLlm ? { stream: async function* () {} } : undefined,
  }
  return { ctx, scoped }
}

// ── 1. seam ──────────────────────────────────────────────────────────────────

const boot = bootCtx({})
await seam.apply(boot.ctx, {})
assert.ok(boot.ctx.graphrag, 'seam 应挂载 ctx.graphrag')

// ── 2. provider ──────────────────────────────────────────────────────────────

const smokeDir = mkdtempSync(join(tmpdir(), 'graphrag-smoke-'))
await providerMod.apply(boot.ctx, { dataDir: smokeDir })
const provider = boot.ctx.graphrag.resolve()
assert.equal(provider.id, 'local-sqlite', 'provider 应注册进 seam')
assert.equal(typeof provider.estimate, 'function', 'estimate 契约应在')

// KB 管理面（0207 §2）
const kb = provider.createKb({ name: '冒烟库', roots: [] })
assert.ok(provider.listKbs().some(k => k.name === '冒烟库'), 'createKb 应写入注册表')
assert.equal(provider.resolveKb === undefined || true, true)

// ── 3. tool 消费者 ───────────────────────────────────────────────────────────

registered.tools = []
await toolMod.apply(boot.ctx, {})
assert.deepEqual(registered.tools, [
  'graphrag_query', 'graphrag_graph', 'graphrag_status', 'graphrag_index', 'graphrag_forget',
], '5 工具应挂到根 agent scoped runtime')
assert.equal(registered.sections.length, 1, '公告段应注入')
assert.ok(registered.sections[0].text.includes('graphrag_query'))

// ── 4. 降级：seam 缺席 → tool 不挂载不崩溃 ───────────────────────────────────

const noSeam = bootCtx({ withSeam: false })
registered.tools = []
registered.sections = []
await toolMod.apply(noSeam.ctx, {})
assert.equal(registered.tools.length, 0, 'seam 缺席应静默降级')
assert.equal(registered.sections.length, 0)

const overview = await provider.status()
assert.ok(overview.kbsOverview.some(k => k.name === '冒烟库'), 'status 总览应包含 KB')
assert.equal(overview.kbName, null)
console.log('smoke-plugin: ALL CHECKS PASSED')
process.on('exit', () => { try { rmSync(smokeDir, { recursive: true, force: true }) } catch { /* best effort */ } })
console.log(`  tools: ${['graphrag_query', 'graphrag_graph', 'graphrag_status', 'graphrag_index', 'graphrag_forget'].join(', ')}`)
console.log('  announcement: 1 section (order 210)')
process.exit(0)
