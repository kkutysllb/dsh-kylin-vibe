/** 加权 LPA 社区检测（docs/02-design/0203 §1.7，ADR-4）。
 *
 * 确定性保证：节点按 id 升序迭代，平票取最小标签——同图同结果
 * （0201 验收项）。纯本地计算，零 LLM。
 */

import { createHash } from 'node:crypto'

import type { SqliteGraphStore } from './graphstore.ts'

export interface LpaEdge {
  readonly src: number
  readonly dst: number
  readonly weight: number
}

export interface LpaCommunity {
  readonly label: number
  readonly members: readonly number[]
  readonly fingerprint: string
}

export interface LpaOptions {
  readonly maxIterations?: number
}

/** 无向加权标签传播。nodes 必须升序去重；返回每个社区的成员与指纹。 */
export function runLpa(nodes: readonly number[], edges: readonly LpaEdge[], opts: LpaOptions = {}): readonly LpaCommunity[] {
  const maxIter = opts.maxIterations ?? 30
  const adjacency = new Map<number, { dst: number; weight: number }[]>()
  for (const e of edges) {
    for (const [a, b] of [[e.src, e.dst], [e.dst, e.src]] as const) {
      let list = adjacency.get(a)
      if (!list) { list = []; adjacency.set(a, list) }
      list.push({ dst: b, weight: e.weight })
    }
  }

  const label = new Map<number, number>()
  for (const n of nodes) label.set(n, n)

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false
    for (const n of nodes) {
      const votes = new Map<number, number>()
      for (const { dst, weight } of adjacency.get(n) ?? []) {
        const l = label.get(dst)
        if (l === undefined) continue
        votes.set(l, (votes.get(l) ?? 0) + weight)
      }
      if (votes.size === 0) continue
      // 最高票；平票取最小标签（确定性）
      let best = -1
      let bestVotes = -1
      for (const l of [...votes.keys()].sort((a, b) => a - b)) {
        const v = votes.get(l) as number
        if (v > bestVotes) { best = l; bestVotes = v }
      }
      if (best >= 0 && best !== label.get(n)) {
        label.set(n, best)
        changed = true
      }
    }
    if (!changed) break
  }

  const groups = new Map<number, number[]>()
  for (const n of nodes) {
    const l = label.get(n) as number
    let g = groups.get(l)
    if (!g) { g = []; groups.set(l, g) }
    g.push(n)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([label_, members]) => ({ label: label_, members: [...members].sort((a, b) => a - b), fingerprint: fingerprintOf(members) }))
}

/** 成员集合的排序 hash（社区指纹，摘要缓存失效判断）。 */
export function fingerprintOf(members: readonly number[]): string {
  return createHash('sha256').update([...members].sort((a, b) => a - b).join(',')).digest('hex').slice(0, 16)
}

export interface RecomputeResult {
  readonly communities: number
  /** 指纹相对旧集合新增（视为需要重算摘要）的社区数。 */
  readonly changed: number
}

/** 从 store 载图 → LPA → 写回社区与实体归属。
 * 返回 changed 供摘要重算调度（0203 §1.7 触发条件由 ingest 判断）。 */
export function recomputeCommunities(store: SqliteGraphStore): RecomputeResult {
  const entities = store.allEntities()
  const relations = store.allRelations()
  const nodes = entities.map(e => e.id).sort((a, b) => a - b)
  const communities = runLpa(nodes, relations.map(r => ({ src: r.srcId, dst: r.dstId, weight: r.weight })))

  const oldFingerprints = new Set(store.listCommunities().map(c => c.fingerprint))
  let changed = 0
  store.clearCommunities()
  for (const c of communities) {
    const id = store.putCommunity({ level: 0, label: c.label, fingerprint: c.fingerprint, memberCount: c.members.length })
    for (const m of c.members) store.assignCommunity(m, id)
    if (!oldFingerprints.has(c.fingerprint)) changed++
  }
  return { communities: communities.length, changed }
}
