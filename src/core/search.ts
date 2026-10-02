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
  type EvidenceChunk, type EvidenceCommunity, type EvidenceEntity, type EvidencePack,
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
  // 种子权重：实体命中按排名（seedLimit..1），chunk 反查实体按命中次数
  const seeds = new Map<number, number>()
  seedHits.forEach((h, i) => seeds.set(h.entity.id, seedLimit - i))
  const chunkCount = new Map<number, number>()
  for (const h of chunkHits) for (const id of store.entitiesInChunk(h.chunk.id)) {
    chunkCount.set(id, (chunkCount.get(id) ?? 0) + 1)
  }
  for (const [id, c] of chunkCount) seeds.set(id, (seeds.get(id) ?? 0) + c)
  // meta 的 seedHits 用两路合计去重数
  const seedHitTotal = new Set([...seedHits.map(h => h.entity.id), ...chunkSeedIds]).size

  const { scores, iterations } = runPpr(
    entities.map(e => e.id),
    relations.map(r => ({ src: r.srcId, dst: r.dstId, weight: r.weight })),
    seeds,
    opts.ppr,
  )
  const topEntities = [...entities]
    .filter(e => scores.get(e.id) !== undefined)
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
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

/** 打分器抽象：一期词法实现（零 LLM），宿主可注入 LLM 打分（0203 §2.2）。 */
export interface GlobalScorer {
  score(question: string, summaryText: string): number
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

export function searchGlobal(store: SqliteGraphStore, question: string, opts: GlobalOptions = {}): EvidencePack {
  const scorer = opts.scorer ?? lexicalGlobalScorer
  const topN = opts.topCommunities ?? 5
  const maxTokens = opts.maxTokens ?? 6000

  const summaries = store.allSummaries()
  if (summaries.length === 0) throw new GraphRagError('NOT_INDEXED', '尚无社区摘要（先建图并生成摘要）')

  const ranked = summaries
    .map(s => ({ s, score: scorer.score(question, s.summary) }))
    .sort((a, b) => b.score - a.score || a.s.communityId - b.s.communityId)
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
    meta: { mode: 'global', seedHits: 0, pprIterations: null, llmCalls: 0, coverage: coverageOf(store) },
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
