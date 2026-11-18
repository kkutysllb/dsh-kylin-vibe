/** adapter 审批策略探测测试（0204 §3 门控决策依赖）：鸭子型读取宿主
 * ApprovalService 的会话覆盖与部署默认；任何异常降级 undefined（按 ask
 * 处理，保持既有审批门行为）。三种访问路径（reflect.get / ctx.get / 属性）
 * 必须等价——宿主变体不保证同一种读法。 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Context } from '@deepseek-ai/cordis'

import { approvalPolicyOf, sandboxModeOf } from '../src/adapter.ts'

type Access = 'reflect' | 'get' | 'prop'

function ctxWith(approval: unknown, via: Access): Context {
  const base: Record<string, unknown> = {}
  if (via === 'reflect') base['reflect'] = { get: (name: string) => (name === 'approval' ? approval : undefined) }
  if (via === 'get') base['get'] = (name: string) => (name === 'approval' ? approval : undefined)
  if (via === 'prop') base['approval'] = approval
  return base as unknown as Context
}

const execWith = (session: unknown): unknown => ({ agent: { session } })

describe('approvalPolicyOf（会话审批策略探测）', () => {

  test('会话覆盖优先于服务默认；三种访问路径等价', () => {
    for (const via of ['reflect', 'get', 'prop'] as const) {
      const overrideNever = { overrideOf: () => 'never', config: { policy: 'ask' } }
      assert.equal(approvalPolicyOf(ctxWith(overrideNever, via), execWith({ id: 's' })), 'never')
    }
    const noOverride = { overrideOf: () => undefined, config: { policy: 'never' } }
    assert.equal(approvalPolicyOf(ctxWith(noOverride, 'reflect'), execWith({ id: 's' })), 'never')
    const overrideAsk = { overrideOf: () => 'ask', config: { policy: 'never' } }
    assert.equal(approvalPolicyOf(ctxWith(overrideAsk, 'reflect'), execWith({ id: 's' })), 'ask')
  })

  test('无 exec.agent.session → 只读服务默认；无 overrideOf 方法也成立', () => {
    const service = { overrideOf: () => 'never', config: { policy: 'ask' } }
    assert.equal(approvalPolicyOf(ctxWith(service, 'reflect'), {}), 'ask')
    const configOnly = { config: { policy: 'never' } }
    assert.equal(approvalPolicyOf(ctxWith(configOnly, 'reflect'), execWith({ id: 's' })), 'never')
  })

  test('服务缺席 / 形状不符 / 读取抛错 / 非法策略 → undefined（按 ask 处理）', () => {
    assert.equal(approvalPolicyOf({} as Context, execWith({ id: 's' })), undefined)
    assert.equal(approvalPolicyOf(ctxWith(null, 'reflect'), execWith({ id: 's' })), undefined)
    assert.equal(approvalPolicyOf(ctxWith({}, 'reflect'), execWith({ id: 's' })), undefined)
    assert.equal(approvalPolicyOf(ctxWith({ overrideOf: () => 'sometimes', config: {} }, 'reflect'), execWith({ id: 's' })), undefined)
    const throwing = { overrideOf: () => { throw new TypeError('released') }, config: { policy: 'never' } }
    assert.equal(approvalPolicyOf(ctxWith(throwing, 'reflect'), execWith({ id: 's' })), undefined)
    const throwingGet = {
      reflect: {
        get: () => { throw new TypeError('cannot get property without inject') },
      },
    } as unknown as Context
    assert.equal(approvalPolicyOf(throwingGet, execWith({ id: 's' })), undefined)
  })
})

// ── sandboxModeOf（会话沙箱模式探测，0204 §3.1 完全权限放行依赖）────────────

function ctxWithSandbox(policy: unknown, via: Access): Context {
  const base: Record<string, unknown> = {}
  if (via === 'reflect') base['reflect'] = { get: (name: string) => (name === 'sandboxPolicy' ? policy : undefined) }
  if (via === 'get') base['get'] = (name: string) => (name === 'sandboxPolicy' ? policy : undefined)
  if (via === 'prop') base['sandboxPolicy'] = policy
  return base as unknown as Context
}

describe('sandboxModeOf（会话沙箱模式探测）', () => {

  test('resolve({session}).mode 三种访问路径等价；无 session 以空查询探测', () => {
    for (const via of ['reflect', 'get', 'prop'] as const) {
      const policy = { resolve: (q: { session?: unknown }) => ({ mode: 'danger-full-access', asked: q.session !== undefined }) }
      assert.equal(sandboxModeOf(ctxWithSandbox(policy, via), execWith({ id: 's' })), 'danger-full-access')
    }
    const sessionless = { resolve: (q: Record<string, unknown>) => ({ mode: q['session'] === undefined ? 'workspace-write' : 'read-only' }) }
    assert.equal(sandboxModeOf(ctxWithSandbox(sessionless, 'reflect'), {}), 'workspace-write')
  })

  test('三档封闭集全部可读', () => {
    for (const mode of ['read-only', 'workspace-write', 'danger-full-access'] as const) {
      const policy = { resolve: () => ({ mode }) }
      assert.equal(sandboxModeOf(ctxWithSandbox(policy, 'reflect'), execWith({ id: 's' })), mode)
    }
  })

  test('服务缺席 / 形状不符 / 非法模式 / 读取抛错 → undefined（不参与决策）', () => {
    assert.equal(sandboxModeOf({} as Context, execWith({ id: 's' })), undefined)
    assert.equal(sandboxModeOf(ctxWithSandbox(null, 'reflect'), execWith({ id: 's' })), undefined)
    assert.equal(sandboxModeOf(ctxWithSandbox({}, 'reflect'), execWith({ id: 's' })), undefined)
    assert.equal(sandboxModeOf(ctxWithSandbox({ resolve: () => ({ mode: 'yolo' }) }, 'reflect'), execWith({ id: 's' })), undefined)
    assert.equal(sandboxModeOf(ctxWithSandbox({ resolve: () => undefined }, 'reflect'), execWith({ id: 's' })), undefined)
    const throwing = { resolve: () => { throw new TypeError('released') } }
    assert.equal(sandboxModeOf(ctxWithSandbox(throwing, 'reflect'), execWith({ id: 's' })), undefined)
    const throwingGet = {
      reflect: {
        get: () => { throw new TypeError('cannot get property without inject') },
      },
    } as unknown as Context
    assert.equal(sandboxModeOf(throwingGet, execWith({ id: 's' })), undefined)
  })
})
