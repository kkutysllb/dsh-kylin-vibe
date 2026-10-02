/** 授权目录扫描与变更检测（docs/02-design/0203 §1.2/§1.3，阶段 A/B）。
 *
 * 安全模型（继承 DSH-RAG，ADR-9）：realpath 规范化防符号链接逃逸；
 * 显式授权前缀匹配；排除模式表（隐藏目录/凭据类默认拒绝）。
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { GraphRagError } from './types.ts'

export interface FileFact {
  readonly path: string          // 相对扫描根的规范路径
  readonly absPath: string       // realpath 结果
  readonly sizeBytes: number
  readonly mtimeMs: number
  readonly contentHash: string   // sha256
}

export interface ScanResult {
  readonly files: readonly FileFact[]
  readonly rejected: readonly { readonly root: string; readonly reason: string }[]
}

/** glob → RegExp：仅支持前缀/后缀/中缀 `*`（够用且可预测）。 */
function globToRegExp(pattern: string): RegExp {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${esc}$`)
}

export const DEFAULT_EXCLUDES: readonly string[] = [
  '.git', 'node_modules', '.DS_Store',
  '.env', '.env.*', '*.pem', '*secret*', '*credential*', '*credentials*',
]

function isExcluded(name: string, patterns: readonly RegExp[]): boolean {
  return patterns.some(re => re.test(name))
}

/** 阶段 A+B：校验授权 → 走目录 → hash。确定性排序输出。
 * roots 必须逐条落在 authorized 的 realpath 前缀内，否则整根拒绝。 */
export function scanRoots(
  roots: readonly string[],
  authorized: readonly string[],
  excludes: readonly string[] = DEFAULT_EXCLUDES,
): ScanResult {
  const authReal = authorized.map(a => realpathSync(a))
  const patterns = [...new Set([...DEFAULT_EXCLUDES, ...excludes])].map(globToRegExp)
  const files: FileFact[] = []
  const rejected: { root: string; reason: string }[] = []

  for (const root of roots) {
    let rootReal: string
    try {
      rootReal = realpathSync(root)
    } catch {
      rejected.push({ root, reason: '路径不存在' })
      continue
    }
    if (!authReal.some(a => rootReal === a || rootReal.startsWith(`${a}/`))) {
      rejected.push({ root, reason: 'NOT_AUTHORIZED：不在授权 roots 内' })
      continue
    }
    walk(rootReal, rootReal, files, patterns)
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files, rejected }
}

function walk(absDir: string, rootReal: string, out: FileFact[], patterns: readonly RegExp[]): void {
  for (const name of readdirSync(absDir).sort()) {
    if (name.startsWith('.') || isExcluded(name, patterns)) continue
    const abs = join(absDir, name)
    const st = statSync(abs)
    if (st.isDirectory()) {
      walk(abs, rootReal, out, patterns)
      continue
    }
    if (!st.isFile()) continue
    const buf = readFileSync(abs)
    out.push({
      path: abs.slice(rootReal.length + 1),
      absPath: abs,
      sizeBytes: st.size,
      mtimeMs: Math.round(st.mtimeMs),
      contentHash: createHash('sha256').update(buf).digest('hex'),
    })
  }
}

/** 阶段 B 的 diff：对已入库 sources 产出三集（0203 §1.3）。 */
export interface DiffResult {
  readonly added: readonly FileFact[]       // 新文件
  readonly changed: readonly FileFact[]     // hash 变化
  readonly removed: readonly string[]       // 已删除路径（原 state 非 deleted）
}

export function diffAgainstIndex(
  scanned: readonly FileFact[],
  known: readonly { path: string; contentHash: string; state: string }[],
): DiffResult {
  const knownByPath = new Map(known.map(k => [k.path, k]))
  const scannedPaths = new Set(scanned.map(f => f.path))
  const added: FileFact[] = []
  const changed: FileFact[] = []
  for (const f of scanned) {
    const k = knownByPath.get(f.path)
    if (k === undefined) added.push(f)
    else if (k.state === 'disabled') continue // 停用=用户主动排除，文件变更也不唤醒
    else if (k.contentHash !== f.contentHash) changed.push(f)
  }
  const removed = known
    .filter(k => !scannedPaths.has(k.path) && k.state !== 'deleted')
    .map(k => k.path)
  return { added, changed, removed }
}

/** 授权校验的独立入口（审批门 dry-run 估算成本用）。 */
export function assertAuthorized(root: string, authorized: readonly string[]): void {
  const rootReal = realpathSync(root)
  if (!authorized.some(a => rootReal === realpathSync(a) || rootReal.startsWith(`${realpathSync(a)}/`))) {
    throw new GraphRagError('NOT_AUTHORIZED', `路径未被授权索引：${root}`)
  }
}
