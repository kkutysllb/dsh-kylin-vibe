import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { KbRegistry, migrateLegacyWorkspaces, slugify } from '../src/core/kb.ts'
import { GraphRagError } from '../src/core/types.ts'

describe('slugify', () => {
  test('latin 保留、CJK 剥离、空回落 kb', () => {
    assert.equal(slugify('Atlas 代码库'), 'atlas')
    assert.equal(slugify('星帆商城文档'), 'kb')
    assert.equal(slugify('  My-KB_01! '), 'my-kb-01')
    assert.equal(slugify('库存服务 (inventory)'), 'inventory')
  })
})

describe('KbRegistry', () => {
  let dir: string
  before(() => { dir = mkdtempSync(join(tmpdir(), 'graphrag-kb-')) })
  after(() => { rmSync(dir, { recursive: true, force: true }) })

  test('create：name 唯一（大小写不敏感）、slug 去重、持久化重载', () => {
    const r = KbRegistry.load(dir)
    const a = r.create({ name: 'Atlas 代码库', roots: ['/a'] })
    assert.equal(a.id, 'atlas')
    assert.throws(() => r.create({ name: 'atlas 代码库', roots: ['/b'] }), /已存在/)
    const b = r.create({ name: 'Atlas 代码库 v2', roots: ['/b'] })
    assert.equal(b.id, 'atlas-v2')
    // slug 碰撞去重：同名 slug 再现 → 追加序号
    const c = r.create({ name: 'ATLAS!!', roots: ['/c'] })
    assert.equal(c.id, 'atlas-3')
    // 重载后仍在
    const r2 = KbRegistry.load(dir)
    assert.equal(r2.list().length, 3)
    assert.ok(r2.byName('ATLAS 代码库'))
    assert.ok(r2.byId('atlas-v2'))
  })

  test('byCwd：唯一命中返回，多命中/零命中 undefined', () => {
    const r = KbRegistry.load(dir)
    r.create({ name: 'x', roots: ['/ws/x'] })
    r.create({ name: 'y', roots: ['/ws/y'] })
    assert.equal(r.byCwd('/ws/x/sub')?.name, 'x')
    assert.equal(r.byCwd('/ws'), undefined) // 零命中
    r.create({ name: 'x2', roots: ['/ws/x/deep'] })
    assert.equal(r.byCwd('/ws/x/deep'), undefined) // x 与 x2 双命中
  })

  test('update/remove：user 库可改，不存在抛错', () => {
    const r = KbRegistry.load(dir)
    const k = r.create({ name: 'edit-me', roots: ['/e'], description: 'd1' })
    const updated = r.update(k.id, { description: 'd2', roots: ['/e2'] })
    assert.equal(updated.description, 'd2')
    assert.deepEqual(updated.roots, ['/e2'])
    r.remove(k.id)
    assert.equal(r.byId(k.id), undefined)
    assert.throws(() => r.update('ghost', { name: 'x' }), (e: unknown) => e instanceof GraphRagError)
    assert.throws(() => r.remove('ghost'), /不存在/)
  })

  test('touchIndexed 回写 lastIndexedAt', () => {
    const r = KbRegistry.load(dir)
    const k = r.create({ name: 'touch', roots: ['/t'] })
    assert.equal(k.lastIndexedAt, null)
    r.touchIndexed(k.id, 12345)
    assert.equal(KbRegistry.load(dir).byId(k.id)?.lastIndexedAt, 12345)
  })
})

describe('migrateLegacyWorkspaces', () => {
  test('旧 workspaces 目录迁移为 legacy KB 并物理搬移；已有注册表时跳过', () => {
    const dir = mkdtempSync(join(tmpdir(), 'graphrag-kb-mig-'))
    try {
      // 造旧布局：workspaces/<hash>/graphrag.db（内容可以是空库）
      mkdirSync(join(dir, 'workspaces', 'abcdef0123456789'), { recursive: true })
      writeFileSync(join(dir, 'workspaces', 'abcdef0123456789', 'graphrag.db'), '')

      const r1 = KbRegistry.load(dir)
      const migrated = migrateLegacyWorkspaces(dir, r1, ['/authorized'])
      assert.equal(migrated.length, 1)
      assert.equal(migrated[0]!.name, 'legacy-abcdef')
      assert.deepEqual(migrated[0]!.roots, ['/authorized'])
      // 物理搬移
      assert.ok(existsSync(join(dir, 'kbs', 'legacy-abcdef')))
      assert.ok(!existsSync(join(dir, 'workspaces', 'abcdef0123456789')))
      // 二次执行（注册表已非空）→ 不迁移
      const r2 = KbRegistry.load(dir)
      assert.deepEqual(migrateLegacyWorkspaces(dir, r2, []), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
