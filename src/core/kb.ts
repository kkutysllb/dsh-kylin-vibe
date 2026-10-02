/** KB 注册表（docs/02-design/0207 §2）：kbs.json 持久化 + slug + 旧布局迁移。
 *
 * - 注册表：`<dataDir>/kbs.json`；每库存储 `dataDir/kbs/<id>/graphrag.db`
 * - name 唯一（大小写不敏感匹配）；id 由 name slug 化 + 去重后缀
 * - 迁移：kbs.json 缺失且存在旧 `workspaces/<cwdhash>/` 布局时，逐目录
 *   移入 `kbs/legacy-<hash6>/` 并注册同名 KB（roots 取当时 provider 配置）
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { GraphRagError, normName, type KnowledgeBase, type KbManaged } from './types.ts'

export interface KbInput {
  readonly name: string
  readonly roots: readonly string[]
  readonly description?: string | null
}

/** 用户可读名 → 存储目录 slug：保留 latin/数字，CJK 剥离（空则回落 kb）。 */
export function slugify(name: string): string {
  const base = name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base === '' ? 'kb' : base.slice(0, 40)
}

export class KbRegistry {
  private kbs: KnowledgeBase[]
  private readonly file: string
  /** 装载/最近一次重读的文件 mtime；外部进程写入后据此重读。 */
  private loadedMtimeMs: number

  private constructor(file: string, kbs: KnowledgeBase[], loadedMtimeMs: number) {
    this.file = file
    this.kbs = kbs
    this.loadedMtimeMs = loadedMtimeMs
  }

  static load(dataDir: string): KbRegistry {
    const file = join(dataDir, 'kbs.json')
    if (!existsSync(file)) return new KbRegistry(file, [], 0)
    const mtime = statSync(file).mtimeMs
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { version?: number; kbs?: KnowledgeBase[] }
    if (raw.version !== 1) throw new GraphRagError('SCHEMA_FUTURE', `kbs.json 版本 ${String(raw.version)} 高于实现`)
    return new KbRegistry(file, raw.kbs ?? [], mtime)
  }

  private save(): void {
    mkdirSync(join(this.file, '..'), { recursive: true })
    writeFileSync(this.file, JSON.stringify({ version: 1, kbs: this.kbs }, null, 2))
    try { this.loadedMtimeMs = statSync(this.file).mtimeMs } catch { /* 写后 stat 失败无碍 */ }
  }

  /** 多宿主共享 dataDir（桌面 app + web host 并存）时，别的进程会写 kbs.json；
   * mtime 变化即重读，避免外部建库/删库在本进程不可见。读失败保留内存态。 */
  private refreshIfChanged(): void {
    try {
      const mtime = statSync(this.file).mtimeMs
      if (mtime === this.loadedMtimeMs) return
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as { version?: number; kbs?: KnowledgeBase[] }
      if (raw.version === 1) {
        this.kbs = raw.kbs ?? []
        this.loadedMtimeMs = mtime
      }
    } catch { /* 文件暂不可读/被并发替换：保留内存态，下次再试 */ }
  }

  list(): readonly KnowledgeBase[] {
    this.refreshIfChanged()
    return this.kbs
  }

  byId(id: string): KnowledgeBase | undefined {
    this.refreshIfChanged()
    return this.kbs.find(k => k.id === id)
  }

  byName(name: string): KnowledgeBase | undefined {
    this.refreshIfChanged()
    const key = normName(name)
    return this.kbs.find(k => normName(k.name) === key)
  }

  /** cwd（realpath 后）落在唯一 KB 的某 root 内 → 该 KB；零/多命中 → undefined。 */
  byCwd(cwdReal: string): KnowledgeBase | undefined {
    this.refreshIfChanged()
    const hits = this.kbs.filter(k => k.roots.some(r => cwdReal === r || cwdReal.startsWith(`${r}/`)))
    return hits.length === 1 ? hits[0] : undefined
  }

  create(input: KbInput, managed: KbManaged = 'user'): KnowledgeBase {
    if (input.name.trim() === '') throw new GraphRagError('INVALID', '知识库名称不能为空')
    if (this.byName(input.name) !== undefined) {
      throw new GraphRagError('INVALID', `知识库名称已存在：${input.name}`)
    }
    let id = slugify(input.name)
    while (this.byId(id) !== undefined) id = `${id}-${this.kbs.length + 1}`
    const kb: KnowledgeBase = {
      id, name: input.name.trim(), roots: [...input.roots], description: input.description ?? null,
      managed, createdAt: Date.now(), lastIndexedAt: null,
    }
    this.kbs.push(kb)
    this.save()
    return kb
  }

  update(id: string, patch: { readonly name?: string; readonly roots?: readonly string[]; readonly description?: string | null }): KnowledgeBase {
    const kb = this.byId(id)
    if (kb === undefined) throw new GraphRagError('INVALID', `知识库不存在：${id}`)
    if (kb.managed === 'config') throw new GraphRagError('INVALID', '配置托管的知识库请修改 cordis.patch.yml 配置')
    if (patch.name !== undefined && normName(patch.name) !== normName(kb.name)) {
      const other = this.byName(patch.name)
      if (other !== undefined && other.id !== id) throw new GraphRagError('INVALID', `知识库名称已存在：${patch.name}`)
    }
    const next: KnowledgeBase = {
      ...kb,
      name: patch.name?.trim() || kb.name,
      roots: patch.roots ? [...patch.roots] : kb.roots,
      description: patch.description === undefined ? kb.description : patch.description,
    }
    this.kbs = this.kbs.map(k => (k.id === id ? next : k))
    this.save()
    return next
  }

  remove(id: string): void {
    const kb = this.byId(id)
    if (kb === undefined) throw new GraphRagError('INVALID', `知识库不存在：${id}`)
    this.kbs = this.kbs.filter(k => k.id !== id)
    this.save()
  }

  touchIndexed(id: string, at: number): void {
    this.kbs = this.kbs.map(k => (k.id === id ? { ...k, lastIndexedAt: at } : k))
    this.save()
  }
}

/** 旧 `workspaces/<hash>/` 布局 → KB（0207 §2.1 迁移）。仅当 kbs.json 不存在时执行。 */
export function migrateLegacyWorkspaces(dataDir: string, registry: KbRegistry, defaultRoots: readonly string[]): readonly KnowledgeBase[] {
  const legacyDir = join(dataDir, 'workspaces')
  if (!existsSync(legacyDir) || registry.list().length > 0) return []
  const migrated: KnowledgeBase[] = []
  for (const hash of readdirSync(legacyDir).filter(n => statSync(join(legacyDir, n)).isDirectory()).sort()) {
    const id = `legacy-${hash.slice(0, 6)}`
    if (registry.byId(id) !== undefined) continue
    const target = join(dataDir, 'kbs', id)
    mkdirSync(join(dataDir, 'kbs'), { recursive: true })
    renameSync(join(legacyDir, hash), target)
    migrated.push(registry.create({
      name: `legacy-${hash.slice(0, 6)}`,
      roots: defaultRoots,
      description: '由单工作区旧布局迁移；如 roots 不符请在面板/配置中修正',
    }, 'user'))
  }
  // 搬空后清理旧布局根目录（含 OS 残留文件则保留）
  const leftovers = readdirSync(legacyDir).filter(n => n !== '.DS_Store')
  if (leftovers.length === 0) rmSync(legacyDir, { recursive: true, force: true })
  return migrated
}
