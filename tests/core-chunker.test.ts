import assert from 'node:assert/strict'
import { test } from 'node:test'

import { chunkText, estimateTokens } from '../src/core/chunker.ts'

test('estimateTokens：CJK 逐字、拉丁按 3.5 字符/token', () => {
  assert.equal(estimateTokens('订单服务'), 4)
  assert.equal(estimateTokens('abcdefgh'), Math.ceil(8 / 3.5))
  assert.equal(estimateTokens('订单 order'), 2 + Math.ceil(5 / 3.5))
})

test('chunkText：空行分块 + 贪心装填，记录行号', () => {
  const md = ['# 标题一', '', '第一段。', '第一段续。', '', '# 标题二', '', '第二段。'].join('\n')
  const chunks = chunkText('a.md', md, { targetTokens: 10, maxTokens: 20 })
  // 标题与后文同块：块为 [标题一] [第一段。第一段续。] [标题二] [第二段。]
  assert.ok(chunks.length >= 2)
  const first = chunks[0]!
  assert.equal(first.startLine, 1)
  assert.equal(first.path, 'a.md')
  assert.equal(first.ordinal, 0)
  for (const c of chunks) {
    assert.ok(c.endLine >= c.startLine)
    assert.ok(c.tokenEst > 0)
  }
})

test('chunkText：超长块行级硬切不超过 maxTokens', () => {
  const long = Array.from({ length: 200 }, (_, i) => `line ${i} ${'x'.repeat(20)}`).join('\n')
  const chunks = chunkText('b.ts', long, { targetTokens: 50, maxTokens: 80 })
  assert.ok(chunks.length > 1)
  for (const c of chunks) assert.ok(c.tokenEst <= 80 + 30, `chunk est ${c.tokenEst}`)
})

test('chunkText：小块合并装填，保留空行分隔与真实行号', () => {
  const chunks = chunkText('c.md', '短文档\n\n另一段')
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0]!.text, '短文档\n\n另一段')
  assert.equal(chunks[0]!.startLine, 1)
  assert.equal(chunks[0]!.endLine, 3)
})

test('chunkText：行列号覆盖原文（拼接可还原行数）', () => {
  const md = ['alpha', '', 'beta', 'gamma', '', 'delta'].join('\n')
  const chunks = chunkText('d.md', md)
  const covered = chunks.map(c => c.endLine - c.startLine + 1).reduce((x, y) => x + y, 0)
  assert.equal(covered, 6)
})
