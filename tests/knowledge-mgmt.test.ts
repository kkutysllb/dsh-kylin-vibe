import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { runIngest, type CommunitySummarizer } from '../src/core/ingest.ts'
import { SqliteGraphStore } from '../src/core/graphstore.ts'
import { diffAgainstIndex, type FileFact } from '../src/core/scanner.ts'
import { searchLocal } from '../src/core/search.ts'
import type { LlmCompleter } from '../src/core/extractor.ts'

const KNOWN = ['甲服务', '乙服务']
function oracleLlm(): LlmCompleter {
  return {
    complete: async (_sys, user) => {
      const found = KNOWN.filter(n => user.includes(n))
      return JSON.stringify({
        entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })),
        relations: found.length >= 2 ? [{ s: found[0], r: 'uses', o: found[1]!, d: null, c: 0.8 }] : [],
      })
    },
  }
}
const summarize: CommunitySummarizer = async input => `社区：${input.members.map(m => m.name).join('、')}`

let dir: string
let store: SqliteGraphStore

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-km-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'a.md'), '# 甲\n\n甲服务使用乙服务完成编排。\n')
  writeFileSync(join(dir, 'docs', 'b.md'), '# 乙\n\n乙服务独立承载存储层。\n')
  store = new SqliteGraphStore(join(dir, 'g.db'))
  await runIngest(store, { authorizedRoots: [dir] }, { llm: oracleLlm(), summarize })
})

after(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('知识管理：停用/统计/同步预览/召回分数', () => {
  test('sourceStats：块/实体/关系贡献统计', () => {
    const a = store.getSource('docs/a.md')!
    const stats = store.sourceStats(a.id)
    assert.ok(stats.chunks >= 1)
    assert.ok(stats.entities >= 2, `a.md 应贡献两个实体（实际 ${stats.entities}）`)
    assert.ok(stats.relations >= 1)
  })

  test('停用来源：chunk FTS 检索排除，启用后恢复', () => {
    const a = store.getSource('docs/a.md')!
    const b = store.getSource('docs/b.md')!
    // 基线：甲服务在 a.md 的 chunk 里可检索
    const before = store.searchChunks(['甲服务'], 20).filter(h => h.chunk.sourceId === a.id)
    assert.ok(before.length >= 1)

    store.setSourceState(a.id, 'disabled')
    const during = store.searchChunks(['甲服务'], 20).filter(h => h.chunk.sourceId === a.id)
    assert.equal(during.length, 0, '停用后 a.md 的 chunk 不应被检索')

    // b.md 不受影响
    const bHits = store.searchChunks(['乙服务'], 20).filter(h => h.chunk.sourceId === b.id)
    assert.ok(bHits.length >= 1)

    // 启用（置 pending）→ 不再是 disabled → 检索恢复
    store.resetSourceToPending(a.id)
    const after = store.searchChunks(['甲服务'], 20).filter(h => h.chunk.sourceId === a.id)
    assert.equal(after.length, before.length)
  })

  test('diff：停用来源的文件变更不进 changed 集', () => {
    const known = store.listSources().map(s => ({ path: s.path, contentHash: s.contentHash, state: s.state }))
    const a = store.getSource('docs/a.md')!
    // a.md 视为停用：内容变更不应进 changed
    const scanned: FileFact[] = [
      { path: 'docs/a.md', absPath: join(dir, 'docs', 'a.md'), sizeBytes: 10, mtimeMs: 1, contentHash: 'CHANGED' },
      { path: 'docs/b.md', absPath: join(dir, 'docs', 'b.md'), sizeBytes: 10, mtimeMs: 1, contentHash: 'CHANGED-B' },
    ]
    const withDisabled = known.map(k => k.path === 'docs/a.md' ? { ...k, state: 'disabled' } : k)
    const diff = diffAgainstIndex(scanned, withDisabled)
    assert.ok(diff.changed.some(c => c.path === 'docs/b.md'))
    assert.ok(!diff.changed.some(c => c.path === 'docs/a.md'), '停用来源的变更不应触发重索引')
    assert.equal(a.id, a.id) // 引用防 lint
  })

  test('召回测试：local 检索证据带分数（FTS 直击非空）', async () => {
    const pack = await searchLocal(store, '甲服务如何使用乙服务', { chunkLimit: 10 })
    assert.ok(pack.chunks.length >= 1)
    const scored = pack.chunks.filter(c => c.score !== null)
    assert.ok(scored.length >= 1, '至少一个 FTS 直击带分数')
    assert.ok(scored.every(c => typeof c.score === 'number' && Number.isFinite(c.score)))
  })
})
