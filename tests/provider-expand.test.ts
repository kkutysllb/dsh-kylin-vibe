import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { clampConfig, LocalGraphRagProvider } from '../src/provider.ts'
import type { LlmCompleter } from '../src/core/extractor.ts'

let dir: string
let provider: LocalGraphRagProvider
let kbId = ''

function oracleLlm(): LlmCompleter {
  return {
    complete: async (_sys, user) => {
      const found = ['枢纽节点', '邻居甲', '邻居乙'].filter(n => user.includes(n))
      return JSON.stringify({
        entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })),
        relations: found.filter(n => n !== '枢纽节点').map(n => ({ s: '枢纽节点', r: 'uses', o: n, d: null, c: 0.8 })),
      })
    },
  }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-expand-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'a.md'), '枢纽节点使用邻居甲与邻居乙完成协同。\n')
  provider = new LocalGraphRagProvider(
    clampConfig({ dataDir: join(dir, 'data'), roots: [dir] }),
    { ctx: null, llm: oracleLlm() },
  )
  const kb = provider.createKb({ name: 'expand-测试', roots: [dir] })
  kbId = kb.id
  await provider.index({ id: kbId }, {}, new AbortController().signal)
})

after(() => {
  provider.dispose()
  rmSync(dir, { recursive: true, force: true })
})

describe('expandNode：图谱视图增量展开', () => {
  test('枢纽节点：返回自身 + 去重邻居 + 带权边', () => {
    const sources = provider.listKnowledge({ id: kbId })
    assert.ok(sources.length >= 1)
    // 找到枢纽节点实体
    // 用浏览接口拿到实体 id（同时验证图谱里有该实体）
    const cards = provider.browseEntities({ id: kbId }, '枢纽节点', 30)
    const hubCard = cards.find(c => c.name === '枢纽节点')
    assert.ok(hubCard !== undefined)
    const r = provider.expandNode({ id: kbId }, hubCard!.id)
    assert.equal(r.node?.name, '枢纽节点')
    assert.ok(r.neighbors.length >= 2, `应有至少两个去重邻居（实际 ${r.neighbors.length}）`)
    assert.ok(r.neighbors.every(n => n.name !== '枢纽节点'))
    assert.ok(r.edges.every(e => e.weight >= 1))
    assert.ok(r.edges.every(e => e.evidence.includes('.md')), '边应带证据 path:lines')
    // 邻居 id 去重（两邻居 id 不同）
    assert.notEqual(r.neighbors[0]?.id, r.neighbors[1]?.id)
  })

  test('不存在的实体 id 抛 INVALID', () => {
    assert.throws(() => provider.expandNode({ id: kbId }, 999999), (e: unknown) =>
      e instanceof Error && e.message.includes('实体不存在'))
  })
})
