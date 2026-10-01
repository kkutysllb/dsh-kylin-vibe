/** Personalized PageRank（docs/02-design/0203 §2.1，ADR-5）。
 *
 * 查询时在图上扩散：种子 = 词法命中的实体（带权重），返回全实体
 * 分值向量。稀疏迭代，全本地零 LLM。
 */

export interface PprEdge {
  readonly src: number
  readonly dst: number
  readonly weight: number
}

export interface PprOptions {
  readonly damping?: number
  readonly iterations?: number
  readonly tolerance?: number
}

/** seed 权重无需归一（内部归一）。迭代至收敛或达上限。 */
export function runPpr(
  nodes: readonly number[],
  edges: readonly PprEdge[],
  seeds: ReadonlyMap<number, number>,
  opts: PprOptions = {},
): { scores: Map<number, number>; iterations: number } {
  const damping = opts.damping ?? 0.85
  const maxIter = opts.iterations ?? 20
  const tol = opts.tolerance ?? 1e-6

  let seedTotal = 0
  for (const w of seeds.values()) seedTotal += w
  if (seedTotal <= 0 || nodes.length === 0) return { scores: new Map(), iterations: 0 }

  // 无向加权邻接（关系图按无向处理：影响分析两个方向都要走）
  const adjacency = new Map<number, { dst: number; w: number }[]>()
  let totalWeight = 0
  for (const e of edges) {
    for (const [a, b] of [[e.src, e.dst], [e.dst, e.src]] as const) {
      let list = adjacency.get(a)
      if (!list) { list = []; adjacency.set(a, list) }
      list.push({ dst: b, w: e.weight })
      totalWeight += e.weight
    }
  }
  // 度归一系数：每条边权重 / 该节点邻接权重和
  const norm = new Map<number, number>()
  for (const [node, list] of adjacency) {
    const sum = list.reduce((acc, x) => acc + x.w, 0)
    if (sum > 0) norm.set(node, sum)
  }

  let ranks = new Map<number, number>()
  for (const n of nodes) ranks.set(n, 0)
  for (const [s, w] of seeds) ranks.set(s, w / seedTotal)

  const jump = new Map<number, number>()
  for (const [s, w] of seeds) jump.set(s, w / seedTotal)

  let iterations = 0
  for (; iterations < maxIter; iterations++) {
    const next = new Map<number, number>()
    for (const n of nodes) next.set(n, 0)
    let dangling = 0
    for (const n of nodes) {
      const r = ranks.get(n) as number
      const list = adjacency.get(n)
      if (!list || list.length === 0) { dangling += r; continue }
      const sum = norm.get(n) as number
      for (const { dst, w } of list) next.set(dst, (next.get(dst) ?? 0) + (r * w) / sum)
    }
    // dangling 质量均匀回流 + 种子跳跃
    const d = damping
    for (const n of nodes) {
      const base = (next.get(n) ?? 0) + dangling / nodes.length
      const j = jump.get(n) ?? 0
      next.set(n, d * base + (1 - d) * j)
    }
    let delta = 0
    for (const n of nodes) delta += Math.abs((next.get(n) ?? 0) - (ranks.get(n) ?? 0))
    ranks = next
    if (delta < tol) { iterations++; break }
  }
  void totalWeight
  return { scores: ranks, iterations }
}
