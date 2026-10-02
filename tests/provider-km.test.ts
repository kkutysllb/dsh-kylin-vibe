import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { clampConfig, LocalGraphRagProvider } from '../src/provider.ts'
import type { LlmCompleter } from '../src/core/extractor.ts'

const KNOWN = ['网关服务', '监控平台']
function oracleLlm(calls: { n: number }): LlmCompleter {
  return {
    complete: async (_sys, user) => {
      calls.n++
      const found = KNOWN.filter(n => user.includes(n))
      return JSON.stringify({
        entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })),
        relations: found.length >= 2 ? [{ s: found[0]!, r: 'uses', o: found[1]!, d: null, c: 0.8 }] : [],
      })
    },
  }
}

let dir: string
let importDir: string
let provider: LocalGraphRagProvider
let kbId = ''
const calls = { n: 0 }

function waitForIdle(p: LocalGraphRagProvider, kbId: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      const rec = p.progress(kbId)
      if (rec === null || rec.phase === 'done' || rec.phase === 'error') return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error(`index not idle: ${rec.phase}`))
      setTimeout(tick, 200)
    }
    tick()
  })
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-pkm-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'a.md'), '网关服务使用监控平台完成告警汇聚。\n')
  importDir = mkdtempSync(join(tmpdir(), 'graphrag-pkm-import-'))
  writeFileSync(join(importDir, 'note.md'), '导入：网关服务对接监控平台。\n')
  provider = new LocalGraphRagProvider(
    clampConfig({ dataDir: join(dir, 'data'), roots: [dir] }),
    { ctx: null, llm: oracleLlm(calls) },
  )
})

after(() => {
  provider.dispose()
  rmSync(dir, { recursive: true, force: true })
  rmSync(importDir, { recursive: true, force: true })
})

describe('知识管理 provider 方法（导入/停用/重索引/同步预览）', () => {
  test('listKnowledge：来源清单带统计/类型/时间', async () => {
    const kb = provider.createKb({ name: 'km-测试库', roots: [dir] })
    kbId = kb.id
    assert.equal(kbId.length > 0, true)
    await provider.index({ id: kb.id }, {}, new AbortController().signal)
    const sources = provider.listKnowledge({ id: kb.id })
    const a = sources.find(s => s.path === 'docs/a.md')
    assert.ok(a !== undefined)
    assert.equal(a.state, 'merged')
    assert.equal(a.ext, '.md')
    assert.ok(a.stats.chunks >= 1)
    assert.ok(a.stats.entities >= 2)
  })

  test('importDirectory：目录文件复制进导入区并入库', async () => {
    const r = provider.importDirectory({ id: kbId }, importDir)
    assert.equal(r.imported, 1)
    assert.equal(r.started, true)
    await waitForIdle(provider, kbId)
    const sources = provider.listKnowledge({ id: kbId })
    const imported = sources.find(s => s.path === 'files/note.md')
    assert.ok(imported !== undefined, '导入文件应出现在来源清单')
    assert.equal(imported?.state, 'merged')
  })

  test('changesPreview：新文件计数与已索引稳态', () => {
    const before = provider.changesPreview({ id: kbId })
    assert.equal(before.added, 0)
    writeFileSync(join(dir, 'docs', 'new.md'), '新文件：网关服务扩容。\n')
    const after = provider.changesPreview({ id: kbId })
    assert.equal(after.added, 1)
    rmSync(join(dir, 'docs', 'new.md'))
  })

  test('setKnowledgeEnabled 停用/启用 + reindexKnowledge 单文件续跑', async () => {
    // 停用
    const off = provider.setKnowledgeEnabled({ id: kbId }, 'docs/a.md', false)
    assert.equal(off.started, false)
    assert.equal(provider.listKnowledge({ id: kbId }).find(s => s.path === 'docs/a.md')?.state, 'disabled')

    // 内容变更 + 单文件重新索引（停用状态下 reindex 视作显式唤醒）
    writeFileSync(join(dir, 'docs', 'a.md'), '网关服务使用监控平台完成告警汇聚。追加：监控平台扩容。\n')
    const re = provider.reindexKnowledge({ id: kbId }, 'docs/a.md')
    assert.equal(re.started, true)
    await waitForIdle(provider, kbId)
    const a = provider.listKnowledge({ id: kbId }).find(s => s.path === 'docs/a.md')
    assert.equal(a?.state, 'merged')

    // 停用→启用：置回待索引并自动续跑
    provider.setKnowledgeEnabled({ id: kbId }, 'docs/a.md', false)
    const on = provider.setKnowledgeEnabled({ id: kbId }, 'docs/a.md', true)
    assert.equal(on.started, true)
    await waitForIdle(provider, kbId)
    assert.equal(provider.listKnowledge({ id: kbId }).find(s => s.path === 'docs/a.md')?.state, 'merged')

    // 追加内容确实落盘（chunk 断言由 store 层用例覆盖）
    assert.ok(readFileSync(join(dir, 'docs', 'a.md'), 'utf8').includes('扩容'))
  })
})
