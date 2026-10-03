/** 三模式检索编排（docs/02-design/0203 §2）：local（FTS 种子 + PPR）、
 * global（社区摘要排序）、traversal（BFS 遍历）。
 *
 * 铁律：图谱只导航、原文才举证（0102 §4.3）——chunks 是一级证据层，
 * entities/relations/communities 是结构理解层（二手信息标记）。
 * 一期 global 用词法打分器（零 LLM）；LLM 打分器由宿主 provider 注入
 * （接口见 GlobalScorer）。
 */

import { estimateTokens } from './chunker.ts'
import type { SqliteGraphStore } from './graphstore.ts'
import { extractTerms } from './lexical.ts'
import { runPpr } from './ppr.ts'
import {
  GraphRagError,
  normName,
  type Entity, type EvidenceChunk, type EvidenceCommunity, type EvidenceEntity, type EvidencePack,
  type EvidenceRelation, type QueryMode, type Subgraph, type SubgraphEdge, type SubgraphNode,
} from './types.ts'

// ── local ────────────────────────────────────────────────────────────────────

export interface LocalOptions {
  readonly seedLimit?: number
  readonly topK?: number
  readonly chunkPerEntity?: number
  readonly maxTokens?: number
  readonly chunkLimit?: number
  readonly ppr?: { damping?: number; iterations?: number }
}

export function searchLocal(store: SqliteGraphStore, question: string, opts: LocalOptions = {}): EvidencePack {
  const seedLimit = opts.seedLimit ?? 12
  const topK = opts.topK ?? 25
  const chunkPerEntity = opts.chunkPerEntity ?? 2
  const maxTokens = opts.maxTokens ?? 6000

  const terms = extractTerms(question)
  // 种子两路（0203 §2.1）：实体 FTS 直接命中 + chunk FTS 命中后反查 mention
  const seedHits = store.findEntitiesByLexical(terms, seedLimit)
  const chunkHits = store.searchChunks(terms, 8)
  const chunkSeedIds = new Set<number>()
  for (const h of chunkHits) for (const id of store.entitiesInChunk(h.chunk.id)) chunkSeedIds.add(id)
  if (seedHits.length === 0 && chunkSeedIds.size === 0) {
    throw new GraphRagError('NO_SEED', `词法未命中实体（terms=${terms.length}）`)
  }

  const entities = store.allEntities()
  const relations = store.allRelations()
  // 种子权重：实体 FTS 直击按 bm25 排名（seedLimit..1）；chunk 反查按**文档秩
  // 加权和**（rank r 的命中块贡献 1/r，伪相关反馈的秩加权惯例）——原始出现
  // 次数会被「枢纽实体高频出现于任意命中块」与 sitemap 类枚举页污染（对账
  // 曾以 count=14 压过词法直击的 12）。总量截到 seedLimit（0203 §2.1「种子
  // 实体集 S ≤ 12」），FTS 直击优先于反查。
  const seeds = new Map<number, number>()
  seedHits.forEach((h, i) => seeds.set(h.entity.id, seedLimit - i))
  const chunkRankW = new Map<number, number>()
  chunkHits.forEach((h, i) => {
    const w = 1 / (i + 1)
    for (const id of store.entitiesInChunk(h.chunk.id)) chunkRankW.set(id, (chunkRankW.get(id) ?? 0) + w)
  })
  const reverseSeeds = [...chunkRankW.entries()]
    .filter(([id]) => !seeds.has(id))
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
  for (const [id, w] of reverseSeeds) {
    if (seeds.size >= seedLimit) break
    seeds.set(id, w)
  }
  // meta 的 seedHits 用两路合计去重数
  const seedHitTotal = new Set([...seedHits.map(h => h.entity.id), ...chunkSeedIds]).size

  const { scores, iterations } = runPpr(
    entities.map(e => e.id),
    relations.map(r => ({ src: r.srcId, dst: r.dstId, weight: r.weight })),
    seeds,
    opts.ppr,
  )
  // 呈现序 = 种子分 ⊕ PPR 分的凸组合（各按最大值归一，各占一半）：
  // 纯 PPR 会把高度数枢纽排到被问实体之前，严格分层则把 PPR 强的桥接实体
  // 挡在种子层后——凸组合让「词法直击」（问题点名实体）与「图邻近」（多跳
  // 桥接）各执一半话语权（混合检索的标准融合公式，无调参）。
  let maxSeedW = 0
  for (const w of seeds.values()) if (w > maxSeedW) maxSeedW = w
  let maxPpr = 0
  for (const v of scores.values()) if (v > maxPpr) maxPpr = v
  const combo = (id: number): number =>
    0.5 * ((seeds.get(id) ?? 0) / maxSeedW) + 0.5 * ((scores.get(id) ?? 0) / maxPpr)
  const topEntities = [...entities]
    .filter(e => scores.get(e.id) !== undefined)
    .sort((a, b) => combo(b.id) - combo(a.id) || a.id - b.id)
    .slice(0, topK)
  const topIds = new Set(topEntities.map(e => e.id))

  // 结构理解层
  const evidEntities: EvidenceEntity[] = topEntities.map(e => ({
    name: e.name, type: e.type, description: e.description,
    community: e.communityId === null ? null : store.communityOf(e.communityId)?.fingerprint ?? null,
  }))
  const edges = store.relationsAmong(topIds, 40)
  const evidRelations: EvidenceRelation[] = edges.map(e => ({
    s: e.srcName, r: e.relation.type, o: e.dstName, w: e.relation.weight,
    evidence: [refFor(store, e.relation.srcId)],
  }))

  // 原文证据层（一级）：FTS 直击带分（bm25，负值更相关）优先，
  // PPR 邻近 chunk 补足（无独立打分 → null），总量受 chunkLimit 钳制
  const chunkLimit = Math.min(Math.max(opts.chunkLimit ?? 12, 3), 50)
  const ftsHits = store.searchChunks(terms, chunkLimit)
  const chunks: EvidenceChunk[] = ftsHits.map(h => toEvidenceChunk(h.chunk, h.score))
  const seenChunk = new Set(chunks.map(c => `${c.path}:${c.lines}`))
  for (const c of fitTokenBudget(store.chunksForEntities([...topIds], chunkPerEntity), maxTokens)) {
    if (chunks.length >= chunkLimit) break
    const key = `${c.sourcePath}:${c.startLine}-${c.endLine}`
    if (seenChunk.has(key)) continue
    seenChunk.add(key)
    chunks.push(toEvidenceChunk(c))
  }

  // 社区摘要层（二手）：有摘要才带
  const communities: EvidenceCommunity[] = []
  const seenCommunity = new Set<number>()
  for (const e of topEntities) {
    if (e.communityId === null || seenCommunity.has(e.communityId)) continue
    seenCommunity.add(e.communityId)
    const summary = store.allSummaries().find(s => s.communityId === e.communityId)
    if (summary) {
      communities.push({ summary: summary.summary, note: 'LLM 生成摘要，引用需回到 chunks', top: summary.entitiesTop })
    }
    if (communities.length >= 3) break
  }

  return {
    mode: 'local', question,
    entities: evidEntities, relations: evidRelations, chunks, communities,
    meta: { mode: 'local', seedHits: seedHitTotal, pprIterations: iterations, llmCalls: 0, coverage: coverageOf(store) },
  }
}

// ── global ───────────────────────────────────────────────────────────────────

/** 打分器抽象：词法实现零 LLM；LLM 实现走 scoreAll 分批打分（0203 §2.2），
 * 单批失败由实现方自行回落词法分（检索可用性优先）。 */
export interface GlobalScorer {
  score(question: string, summaryText: string): number
  /** 分批 LLM 打分（可选）：一次返回全部摘要的 0-10 分与成本。 */
  scoreAll?(
    question: string,
    summaries: readonly string[],
  ): Promise<{ readonly scores: readonly number[]; readonly llmCalls: number; readonly tokensIn: number; readonly tokensOut: number }>
}

export const lexicalGlobalScorer: GlobalScorer = {
  score(question: string, summaryText: string): number {
    const hay = summaryText.toLowerCase()
    return extractTerms(question).reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0)
  },
}

export interface GlobalOptions {
  readonly scorer?: GlobalScorer
  readonly topCommunities?: number
  readonly maxTokens?: number
}

export async function searchGlobal(store: SqliteGraphStore, question: string, opts: GlobalOptions = {}): Promise<EvidencePack> {
  const scorer = opts.scorer ?? lexicalGlobalScorer
  const topN = opts.topCommunities ?? 5
  const maxTokens = opts.maxTokens ?? 6000

  const summaries = store.allSummaries()
  if (summaries.length === 0) throw new GraphRagError('NOT_INDEXED', '尚无社区摘要（先建图并生成摘要）')

  // ≤8 个社区：全部直进证据包，零 LLM（0203 §2.2 第 1 步）
  let ranked: { s: (typeof summaries)[number]; score: number }[]
  let llmCalls = 0
  let tokensIn = 0
  let tokensOut = 0
  if (summaries.length > 8 && scorer.scoreAll !== undefined) {
    const out = await scorer.scoreAll(question, summaries.map(s => s.summary))
    ranked = summaries.map((s, i) => ({ s, score: out.scores[i] ?? 0 }))
      .sort((a, b) => b.score - a.score || a.s.communityId - b.s.communityId)
    llmCalls = out.llmCalls
    tokensIn = out.tokensIn
    tokensOut = out.tokensOut
  } else {
    ranked = summaries
      .map(s => ({ s, score: scorer.score(question, s.summary) }))
      .sort((a, b) => b.score - a.score || a.s.communityId - b.s.communityId)
  }
  const picked = summaries.length <= 8 ? ranked : ranked.slice(0, topN)

  const communities: EvidenceCommunity[] = []
  const entities: EvidenceEntity[] = []
  const chunks: EvidenceChunk[] = []
  for (const { s } of picked) {
    communities.push({ summary: s.summary, note: 'LLM 生成摘要，引用需回到 chunks', top: s.entitiesTop })
    // 代表实体覆盖面：12 个（社区摘要式回答的代表名单，token 预算内）
    for (const e of store.entitiesByCommunity(s.communityId, 12)) {
      entities.push({ name: e.name, type: e.type, description: e.description, community: s.fingerprintAt })
      for (const c of store.chunksForEntities([e.id], 1)) chunks.push(toEvidenceChunk(c))
    }
  }
  return {
    mode: 'global', question,
    entities, relations: [], chunks: fitTokenBudget(chunks, maxTokens), communities,
    meta: { mode: 'global', seedHits: 0, pprIterations: null, llmCalls, tokensIn, tokensOut, coverage: coverageOf(store) },
  }
}

// ── traversal ────────────────────────────────────────────────────────────────

export interface TraverseOptions {
  readonly direction?: 'out' | 'in' | 'both'
  readonly hops?: number
  readonly relationTypes?: readonly string[]
  readonly maxNodes?: number
}

export function searchTraversal(store: SqliteGraphStore, seed: string, opts: TraverseOptions = {}): Subgraph {
  const direction = opts.direction ?? 'both'
  // 核心层允许深遍历（评测/外部引擎用）；agent 工具面在参数 schema 收敛到 1..4（0204）
  const hops = Math.min(Math.max(opts.hops ?? 2, 1), 10)
  const maxNodes = Math.min(opts.maxNodes ?? 200, 500)

  const exact = store.getEntity(normName(seed))
  let startId: number
  if (exact) {
    startId = exact.id
  } else {
    const fuzzy = store.findEntitiesByLexical(extractTerms(seed), 5)
    if (fuzzy.length === 0) throw new GraphRagError('NO_SEED', `未找到实体：${seed}`)
    if (fuzzy.length > 1) {
      return {
        seed, resolved: [], direction, hops, nodes: [], edges: [], truncated: false,
        ambiguousSeeds: fuzzy.map(f => f.entity.name),
      }
    }
    startId = (fuzzy[0] as { entity: { id: number } }).entity.id
  }

  const rows = store.bfs([startId], hops, direction, opts.relationTypes, maxNodes)
  const nodes: SubgraphNode[] = rows.nodes.map(e => ({
    id: e.id, name: e.name, type: e.type, degree: e.degree, communityId: e.communityId,
  }))
  const edges: SubgraphEdge[] = rows.edges.map(e => ({
    srcId: e.relation.srcId, dstId: e.relation.dstId,
    s: e.srcName, r: e.relation.type, o: e.dstName, w: e.relation.weight,
    evidence: [refFor(store, e.relation.srcId)],
  }))
  return { seed, resolved: [store.getEntityById(startId)?.name ?? seed], direction, hops, nodes, edges, truncated: rows.truncated, ambiguousSeeds: [] }
}

// ── 共用 ─────────────────────────────────────────────────────────────────────

function refFor(store: SqliteGraphStore, entityId: number): { path: string; lines: string } {
  const c = store.evidenceChunkFor(entityId)
  return { path: c?.sourcePath ?? '(无原文)', lines: c ? `${c.startLine}-${c.endLine}` : '-' }
}

function toEvidenceChunk(c: { sourcePath: string; startLine: number; endLine: number; text: string }, score: number | null = null): EvidenceChunk {
  return { path: c.sourcePath, lines: `${c.startLine}-${c.endLine}`, text: c.text, score }
}

/** 按 token 预算截断 chunk 列表（保持顺序）。 */
function fitTokenBudget<T extends { text: string }>(chunks: readonly T[], maxTokens: number): T[] {
  const out: T[] = []
  let used = 0
  for (const c of chunks) {
    const est = estimateTokens(c.text)
    if (used + est > maxTokens) break
    out.push(c)
    used += est
  }
  return out
}

function coverageOf(store: SqliteGraphStore): string {
  const c = store.counts()
  return `${c.sources} files / ${c.entities} entities / ${c.relations} relations`
}

export type { QueryMode }
