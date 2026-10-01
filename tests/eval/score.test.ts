import assert from 'node:assert/strict'
import { test } from 'node:test'

import { globalCoverage, localScore, traversalPR, type EvalAnswer } from './score.ts'

const a = (parts: Partial<EvalAnswer>): EvalAnswer => ({
  chunks: [],
  ...parts,
})

test('localScore：实体组任一可接受名命中即算（大小写不敏感）', () => {
  const ans = a({
    chunks: [
      { path: 'x.md', text: '订单服务（OrderService）调用库存服务扣减' },
      { path: 'y.md', text: '无关内容' },
    ],
  })
  const s = localScore(ans, {
    entities: [['订单服务', 'OrderService'], ['库存服务', 'InventoryService'], ['不存在的实体', 'NoSuchThing']],
    relations: [{ s: '订单服务', r: 'uses', o: '库存服务' }],
  })
  assert.equal(s.entityHit, 2 / 3)
  assert.equal(s.relationRecall, 1)
})

test('localScore：entityHit 只看前 5 个 chunk（hit@5 语义）', () => {
  const filler = Array.from({ length: 6 }, (_, i) => ({ path: `f${i}.md`, text: `填充 ${i}` }))
  const ans = a({ chunks: [{ path: 'hit.md', text: '支付服务与风控服务协作' }, ...filler] })
  const s = localScore(ans, { entities: [['支付服务'], ['风控服务']], relations: [] })
  // 命中块排在第 1 位，进入前 5
  assert.equal(s.entityHit, 1)
})

test('localScore：relationRecall 要求两端同块共现', () => {
  const ans = a({
    chunks: [
      { path: 'a.md', text: '只有订单服务' },
      { path: 'b.md', text: '只有库存服务' },
    ],
  })
  const s = localScore(ans, { entities: [], relations: [{ s: '订单服务', r: 'uses', o: '库存服务' }] })
  assert.equal(s.relationRecall, 0)
})

test('localScore：entities 层（图配置）参与实体命中', () => {
  const ans = a({ chunks: [], entities: ['通知服务', '消息队列'] })
  const s = localScore(ans, { entities: [['通知服务', 'NotificationService'], ['消息队列', 'MessageQueue']], relations: [] })
  assert.equal(s.entityHit, 1)
})

test('globalCoverage：关键词命中按点计数，communities 文本参与', () => {
  const ans = a({
    chunks: [{ path: 'a.md', text: '对账与事件溯源是一致性支柱' }],
    communities: ['本社区负责分布式锁与幂等性'],
  })
  const c = globalCoverage(ans, {
    points: [['对账', 'Reconciliation'], ['幂等性', 'Idempotency'], ['数据库分片', 'DatabaseSharding']],
  })
  assert.equal(c, 2 / 3)
})

test('traversalPR：nodes 优先，缺席时回退 chunk 路径去重', () => {
  const g = { goldenFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts'] }
  const p1 = traversalPR(a({ nodes: ['src/a.ts', 'src/b.ts', 'src/x.ts'] }), g)
  assert.equal(p1.precision, 2 / 3)
  assert.equal(p1.recall, 2 / 3)

  const p2 = traversalPR(a({ chunks: [{ path: 'src/a.ts', text: 'x' }, { path: 'src/a.ts', text: 'y' }] }), g)
  assert.equal(p2.precision, 1)
  assert.equal(p2.recall, 1 / 3)
})

test('traversalPR：空集边界（空 golden 记满分召回，空返回记零精确）', () => {
  assert.deepEqual(traversalPR(a({ nodes: [] }), { goldenFiles: [] }), { precision: 0, recall: 1, f1: 0 })
  assert.equal(traversalPR(a({ nodes: [] }), { goldenFiles: ['a'] }).recall, 0)
})
