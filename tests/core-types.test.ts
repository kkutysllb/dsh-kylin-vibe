import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normName, GraphRagError, ENTITY_TYPES, RELATION_TYPES } from '../src/core/types.ts'

test('normName 规范化：小写 + 去符号，保留 CJK', () => {
  assert.equal(normName('  SessionStore '), 'sessionstore')
  assert.equal(normName('订单服务'), '订单服务')
  assert.equal(normName('Order-Service_v2 (core)'), 'orderservicev2core')
  assert.equal(normName('`InventoryGateway`'), 'inventorygateway')
})

test('类型集是封闭且不重复的', () => {
  assert.equal(new Set(ENTITY_TYPES).size, ENTITY_TYPES.length)
  assert.equal(new Set(RELATION_TYPES).size, RELATION_TYPES.length)
})

test('GraphRagError 携带稳定错误码', () => {
  const err = new GraphRagError('NOT_INDEXED', '工作区尚未建立图谱')
  assert.equal(err.code, 'NOT_INDEXED')
  assert.match(err.message, /^\[NOT_INDEXED\]/)
})
