import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractTerms, LexicalIndex } from '../src/core/lexical.ts'

test('extractTerms：CJK 取 3-gram，拉丁小写 ≥3', () => {
  const terms = extractTerms('订单服务与 InventoryService 如何协作？')
  assert.ok(terms.includes('订单服'))
  assert.ok(terms.includes('单服务'))
  assert.ok(terms.includes('inventoryservice'))
  assert.ok(!terms.includes('与'))
})

test('extractTerms：去重且无空串', () => {
  const terms = extractTerms('测试 测试。test, TEST')
  assert.equal(new Set(terms).size, terms.length)
  assert.ok(!terms.includes(''))
})

test('LexicalIndex：BM25 命中并按相关性排序', () => {
  const rows = [
    { id: 1, path: 'a.md', text: '订单服务负责订单状态机的流转与事件溯源' },
    { id: 2, path: 'b.md', text: '库存服务负责库存扣减与对账' },
    { id: 3, path: 'c.md', text: '订单服务与库存服务协作：下单调用库存扣减' },
  ]
  const idx = new LexicalIndex(rows)
  const hits = idx.search(extractTerms('订单服务与库存服务如何协作'), 3)
  assert.equal(hits.length, 3)
  // c.md 同时包含两者，应排最前
  assert.equal(hits[0]!.path, 'c.md')
  idx.close()
})

test('LexicalIndex：代码标识符 trigram 检索', () => {
  const rows = [
    { id: 1, path: 'src/db/db-01.ts', text: "import { core01Run } from '../core/core-01.js'" },
    { id: 2, path: 'src/http/http-02.ts', text: 'export function http02Run(input: string): string' },
  ]
  const idx = new LexicalIndex(rows)
  const hits = idx.search(['core01run', 'core-01'], 2)
  assert.ok(hits.length >= 1)
  assert.equal(hits[0]!.path, 'src/db/db-01.ts')
  idx.close()
})

test('LexicalIndex：空 terms 返回空结果', () => {
  const idx = new LexicalIndex([{ id: 1, path: 'a', text: 'x' }])
  assert.deepEqual(idx.search([], 5), [])
  idx.close()
})
