import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildExtractionUser, computeMentions, extractChunk, stripFences, validateExtraction,
  type LlmCompleter,
} from '../src/core/extractor.ts'

test('stripFences：剥围栏、截取花括号主体', () => {
  assert.equal(stripFences('```json\n{"entities":[]}\n```'), '{"entities":[]}')
  assert.equal(stripFences('好的，以下是结果：\n{"entities":[]} 请查收'), '{"entities":[]}')
  assert.equal(stripFences('  {"a":1}  '), '{"a":1}')
  assert.equal(stripFences('完全不是 JSON'), '完全不是 JSON')
})

test('validateExtraction：封闭集外类型与低置信丢弃并计数', () => {
  const { items, dropped } = validateExtraction({
    entities: [
      { n: '订单服务', t: 'module', d: '编排', c: 0.8 },
      { n: '神秘物', t: 'wizard', d: null, c: 0.9 },
      { n: '低置信', t: 'concept', d: null, c: 0.3 },
    ],
    relations: [
      { s: '订单服务', r: 'uses', o: '库存服务', d: null, c: 0.8 },
      { s: 'a', r: '魔法', o: 'b', d: null, c: 1.0 },
    ],
  }, 0.6)
  assert.equal(items.entities.length, 1)
  assert.equal(items.relations.length, 1)
  assert.equal(dropped, 3)
})

test('computeMentions：多别名多次出现，latin 大小写不敏感，按位置排序', () => {
  const m = computeMentions('OrderService 调用 orderservice 与 订单服务', ['OrderService', '订单服务'])
  assert.equal(m.length, 3)
  assert.deepEqual(m.map(x => x.spanStart), [0, 16, 31])
  assert.ok(m.every(x => x.normName.length > 0))
})

function stubLlm(responses: string[], onError?: (call: number) => Promise<string>): { llm: LlmCompleter; calls: string[] } {
  const calls: string[] = []
  let i = 0
  return {
    calls,
    llm: {
      complete: async (system, user) => {
        calls.push(`${system.slice(0, 12)}|${user.slice(0, 12)}`)
        if (onError && i === 0) {
          i++
          return onError(i)
        }
        const r = responses[Math.min(i++, responses.length - 1)]
        if (r === undefined) throw new Error('stub exhausted')
        return r
      },
    },
  }
}

test('extractChunk：合法输出一次调用成功', async () => {
  const good = JSON.stringify({
    entities: [{ n: '支付服务', t: 'module', d: '收单', c: 0.8 }],
    relations: [{ s: '支付服务', r: 'uses', o: '风控服务', d: null, c: 0.8 }],
  })
  const { llm, calls } = stubLlm([good])
  const res = await extractChunk(llm, '支付服务使用风控服务', 'docs/pay.md')
  assert.equal(res.ok, true)
  if (res.ok) {
    assert.equal(res.items.entities.length, 1)
    assert.equal(res.llmCalls, 1)
  }
  assert.equal(calls.length, 1)
})

test('extractChunk：畸形输出触发一次修复重试后成功（2 次调用）', async () => {
  const bad = '好的，结果如下：{"entities": [{"n":"X","t":"concept","c":0.8}   （未完结，抱歉）'
  const good = '```json\n{"entities":[{"n":"X","t":"concept","d":null,"c":0.8}],"relations":[]}\n```'
  const seq: string[] = [bad, good]
  const llm: LlmCompleter = { complete: async () => seq.shift() ?? '' }
  const res = await extractChunk(llm, 'X 是一个概念', 'docs/x.md')
  assert.equal(res.ok, true)
  if (res.ok) assert.equal(res.llmCalls, 2)
})

test('extractChunk：两次解析失败 → PARSE_FAILED 进隔离语义', async () => {
  const llm: LlmCompleter = { complete: async () => '这不是 JSON' }
  const res = await extractChunk(llm, '文本', 'docs/y.md')
  assert.equal(res.ok, false)
  if (!res.ok) {
    assert.equal(res.errorCode, 'PARSE_FAILED')
    assert.equal(res.llmCalls, 2)
    assert.equal(res.rawOutput, '这不是 JSON')
  }
})

test('extractChunk：LLM 抛错 → LLM_ERROR，零调用计数', async () => {
  const llm: LlmCompleter = { complete: async () => { throw new Error('RATE_LIMIT') } }
  const res = await extractChunk(llm, '文本', 'docs/z.md')
  assert.equal(res.ok, false)
  if (!res.ok) {
    assert.equal(res.errorCode, 'LLM_ERROR')
    assert.equal(res.llmCalls, 0)
  }
})

test('extractChunk：合法 JSON 但条目全被校验丢弃 → PARSE_FAILED（而非静默空图）', async () => {
  const raw = JSON.stringify({ entities: [{ n: 'A', t: 'wizard', c: 1 }], relations: [] })
  const llm: LlmCompleter = { complete: async () => raw }
  const res = await extractChunk(llm, '文本', 'docs/w.md')
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.errorCode, 'PARSE_FAILED')
})

test('extractChunk：真无实体 → EMPTY（非失败，调用方跳过即可）', async () => {
  const raw = JSON.stringify({ entities: [], relations: [] })
  const llm: LlmCompleter = { complete: async () => raw }
  const res = await extractChunk(llm, '纯空白文本', 'docs/v.md')
  assert.equal(res.ok, false)
  if (!res.ok) assert.equal(res.errorCode, 'EMPTY')
})

test('buildExtractionUser：带来源路径头', () => {
  const u = buildExtractionUser('正文', 'src/a.ts')
  assert.ok(u.startsWith('来源：src/a.ts'))
  assert.ok(u.includes('正文'))
})
