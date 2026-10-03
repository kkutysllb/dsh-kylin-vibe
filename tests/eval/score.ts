/** 冻结评测评分器（docs/02-design/0206 §4）。
 *
 * 纯函数、配置无关：flat-bm25 / graph-local / graph-full 都产出
 * EvalAnswer 形态后进同一评分器。评分器自身必须可测（0206 §4）。
 */

export interface EvalAnswer {
  /** 检索到的原文块（一级证据）。 */
  readonly chunks: readonly { readonly path: string; readonly text: string }[]
  /** 图配置额外返回的实体名（结构理解层）。 */
  readonly entities?: readonly string[]
  /** 图配置额外返回的社区摘要文本。 */
  readonly communities?: readonly string[]
  /** traversal 配置返回的节点/文件集。 */
  readonly nodes?: readonly string[]
}

export interface LocalGolden {
  /** 每组是同一实体的可接受名（中文名/英文名/别名）。 */
  readonly entities: readonly (readonly string[])[]
  readonly relations: readonly { readonly s: string; readonly r: string; readonly o: string }[]
}

export interface GlobalGolden {
  /** 每点是关键点；命中 = 任一关键词出现。 */
  readonly points: readonly (readonly string[])[]
}

export interface TraversalGolden {
  readonly goldenFiles: readonly string[]
}

function haystackOf(answer: EvalAnswer, extra: boolean): string {
  const parts: string[] = answer.chunks.map(c => c.text)
  if (extra) {
    if (answer.entities) parts.push(...answer.entities)
    if (answer.communities) parts.push(...answer.communities)
  }
  return parts.join('\n').toLowerCase()
}

function containsAny(haystack: string, names: readonly string[]): boolean {
  return names.some(n => n.trim() !== '' && haystack.includes(n.trim().toLowerCase()))
}

/** local：entityHit = 命中实体组占比（在前 5 个 chunk + 实体层内）；
 * relationRecall = 三元组两端同块共现占比。 */
export function localScore(answer: EvalAnswer, golden: LocalGolden): { entityHit: number; relationRecall: number } {
  const top5 = { ...answer, chunks: answer.chunks.slice(0, 5) }
  const hay = haystackOf(top5, true)
  const total = golden.entities.length
  const hit = total === 0 ? 0 : golden.entities.filter(g => containsAny(hay, g)).length
  const rTotal = golden.relations.length
  const rHit = rTotal === 0 ? 0 : golden.relations.filter(rel =>
    answer.chunks.some(c => {
      const t = c.text.toLowerCase()
      return t.includes(rel.s.toLowerCase()) && t.includes(rel.o.toLowerCase())
    })).length
  return {
    entityHit: total === 0 ? 1 : hit / total,
    relationRecall: rTotal === 0 ? 1 : rHit / rTotal,
  }
}

/** local MRR@k（门槛 v2 排序敏感指标，0206 §3.2 v2）：golden 实体组在证据
 * 排序中的倒数排名均值。图配置用实体层排序（PPR 序）；flat 无实体层，
 * 排序回落 chunk 序（首个含别名的 chunk 位次）——两配置各用其原生排序。 */
export function localMrr(answer: EvalAnswer, golden: LocalGolden, k = 5): number {
  const groups = golden.entities
  if (groups.length === 0) return 1
  const useEntityLayer = answer.entities !== undefined && answer.entities.length > 0
  const rr = groups.map(g => {
    const aliases = g.map(a => a.trim().toLowerCase()).filter(a => a !== '')
    let rank = Number.POSITIVE_INFINITY
    if (useEntityLayer) {
      const idx = (answer.entities as readonly string[]).findIndex(name => aliases.includes(name.trim().toLowerCase()))
      if (idx >= 0) rank = idx + 1
    } else {
      const idx = answer.chunks.findIndex(c => aliases.some(a => c.text.toLowerCase().includes(a)))
      if (idx >= 0) rank = idx + 1
    }
    return rank <= k ? 1 / rank : 0
  })
  return rr.reduce((a, b) => a + b, 0) / rr.length
}

/** global：关键点覆盖率（chunks + communities 文本）。 */
export function globalCoverage(answer: EvalAnswer, golden: GlobalGolden): number {
  const hay = haystackOf(answer, true)
  const total = golden.points.length
  const hit = total === 0 ? 0 : golden.points.filter(p => containsAny(hay, p)).length
  return total === 0 ? 1 : hit / total
}

/** traversal：对返回文件/节点集算 P/R/F1。 */
export function traversalPR(answer: EvalAnswer, golden: TraversalGolden): { precision: number; recall: number; f1: number } {
  const returned = new Set(answer.nodes ?? [...new Set(answer.chunks.map(c => c.path))])
  const goldenSet = new Set(golden.goldenFiles)
  let inter = 0
  for (const g of goldenSet) if (returned.has(g)) inter++
  const precision = returned.size === 0 ? 0 : inter / returned.size
  const recall = goldenSet.size === 0 ? 1 : inter / goldenSet.size
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { precision, recall, f1 }
}
