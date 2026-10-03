/** 领域类型：GraphRAG 核心库的公共词汇表。
 *
 * 对应 docs/02-design/0202（数据模型与存储设计）。这些类型是引擎无关的
 * 纯数据契约：SQLite 实现的行形态、抽取管线的中间产物、查询证据包都
 * 以这里为准。宿主面（Cordis ctx 等）不允许出现在本文件。
 */

// ── 实体与关系 ───────────────────────────────────────────────────────────────

/** 抽取目标实体的封闭类型集（0203 §1.5 prompt 契约）。 */
export const ENTITY_TYPES = [
  'module',
  'file',
  'function',
  'class',
  'type',
  'concept',
  'config',
  'cli',
  'api',
  'external_dependency',
  'test',
] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

/** 关系类型的封闭集（0203 §1.5）。 */
export const RELATION_TYPES = [
  'defines',
  'uses',
  'calls',
  'imports',
  'depends_on',
  'configures',
  'tests',
  'relates_to',
] as const
export type RelationType = (typeof RELATION_TYPES)[number]

/** 实体规范化键：lowercase + 去除非字母数字外的符号（保留 CJK）。 */
export function normName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s`*_\-./\\()[\]{}<>"'!?,;:]+/g, '')
}

export interface Entity {
  readonly id: number
  readonly normName: string
  readonly name: string
  readonly type: EntityType
  /** 合并后的描述——二手信息，证据包中需标记（0204 §2.1）。 */
  readonly description: string | null
  readonly communityId: number | null
  readonly degree: number
}

export interface EntityAlias {
  readonly entityId: number
  readonly alias: string
}

export interface Relation {
  readonly id: number
  readonly srcId: number
  readonly dstId: number
  readonly type: RelationType
  /** mention 聚合计数。 */
  readonly weight: number
  readonly description: string | null
  /** 抽取置信度的聚合均值。 */
  readonly confidence: number
}

// ── 源文件与文本块 ───────────────────────────────────────────────────────────

export type SourceState =
  | 'pending'
  | 'chunked'
  | 'extracting'
  | 'extracted'
  | 'merged'
  | 'failed'
  | 'quarantined'
  | 'disabled'
  | 'deleted'

export interface SourceRow {
  readonly id: number
  /** 相对工作区根的规范路径。 */
  readonly path: string
  /** realpath 结果，审计用；不进任何 LLM 输入（0202 §7）。 */
  readonly absPath: string
  readonly contentHash: string
  readonly sizeBytes: number
  readonly mtimeMs: number
  readonly state: SourceState
  readonly error: string | null
}

export interface ChunkRef {
  readonly id: number
  readonly sourceId: number
  readonly sourcePath: string
  readonly ordinal: number
  readonly startLine: number
  readonly endLine: number
  readonly startCol: number
  readonly endCol: number
  readonly text: string
}

// ── 社区 ─────────────────────────────────────────────────────────────────────

export interface Community {
  readonly id: number
  /** 预留分层（ADR-4）：一期恒为 0。 */
  readonly level: number
  readonly label: number
  /** 成员规范名集合的排序 hash——摘要缓存失效判断（0203 §1.7）。 */
  readonly fingerprint: string
  readonly memberCount: number
}

export interface CommunitySummary {
  readonly communityId: number
  /** LLM 生成——二手信息。 */
  readonly summary: string
  readonly entitiesTop: readonly string[]
  readonly generatedAt: number
  readonly fingerprintAt: string
}

// ── 隔离区与批次 ─────────────────────────────────────────────────────────────

export type QuarantineErrorCode = 'PARSE_FAILED' | 'LLM_ERROR' | 'SCHEMA_INVALID'

export interface QuarantineEntry {
  readonly id: number
  readonly chunkId: number | null
  readonly rawInput: string
  readonly rawOutput: string | null
  readonly errorCode: QuarantineErrorCode
  readonly errorDetail: string | null
  readonly createdAt: number
  readonly resolved: boolean
}

export interface ExtractionBatch {
  readonly id: number
  readonly startedAt: number
  readonly finishedAt: number | null
  readonly status: 'running' | 'done' | 'aborted' | 'failed'
  readonly llmCalls: number
  readonly tokensIn: number
  readonly tokensOut: number
  readonly filesTotal: number
  readonly filesDone: number
}

// ── 抽取产物（管线中间态）───────────────────────────────────────────────────

/** 单个 chunk 的一次 LLM 抽取解析后的产物（0203 §1.5 输出模式）。 */
export interface ExtractedItem {
  readonly entities: readonly {
    readonly n: string
    readonly t: EntityType
    readonly d: string | null
    readonly c: number
  }[]
  readonly relations: readonly {
    readonly s: string
    readonly r: RelationType
    readonly o: string
    readonly d: string | null
    readonly c: number
  }[]
}

// ── 查询面 ───────────────────────────────────────────────────────────────────

export type QueryMode = 'local' | 'global'

export interface EvidenceChunk {
  readonly path: string
  readonly lines: string
  readonly text: string
  /** 检索打分（local 的 FTS bm25，负值更相关）；无打分来源为 null。 */
  readonly score: number | null
}

export interface EvidenceEntity {
  readonly name: string
  readonly type: EntityType
  readonly description: string | null
  readonly community: string | null
}

export interface EvidenceRelation {
  readonly s: string
  readonly r: RelationType
  readonly o: string
  readonly w: number
  readonly evidence: readonly { readonly path: string; readonly lines: string }[]
}

export interface EvidenceCommunity {
  readonly summary: string
  readonly note: 'LLM 生成摘要，引用需回到 chunks'
  readonly top: readonly string[]
}

export interface QueryMeta {
  readonly mode: QueryMode
  readonly seedHits: number
  readonly pprIterations: number | null
  readonly llmCalls: number
  /** global LLM 打分的成本（0203 §2.2 第 4 步；词法路径为 0/缺省）。 */
  readonly tokensIn?: number
  readonly tokensOut?: number
  readonly coverage: string
}

/** local/global 查询的统一证据包（0204 §2.1）。分级呈现：结构理解层
 * （entities/relations/communities，二手）与原文证据层（chunks，一级）。 */
export interface EvidencePack {
  readonly mode: QueryMode
  readonly question: string
  readonly entities: readonly EvidenceEntity[]
  readonly relations: readonly EvidenceRelation[]
  readonly chunks: readonly EvidenceChunk[]
  readonly communities: readonly EvidenceCommunity[]
  readonly meta: QueryMeta
}

export interface SubgraphNode {
  readonly id: number
  readonly name: string
  readonly type: EntityType
  readonly degree: number
  readonly communityId: number | null
}

export interface SubgraphEdge {
  readonly srcId: number
  readonly dstId: number
  readonly s: string
  readonly r: RelationType
  readonly o: string
  readonly w: number
  readonly evidence: readonly { readonly path: string; readonly lines: string }[]
}

/** `graphrag_graph` 的输出（0204 §2.2）。 */
export interface Subgraph {
  readonly seed: string
  readonly resolved: readonly string[]
  readonly direction: 'out' | 'in' | 'both'
  readonly hops: number
  readonly nodes: readonly SubgraphNode[]
  readonly edges: readonly SubgraphEdge[]
  readonly truncated: boolean
  /** seed 多命中时的候选列表（0204 §2.2 ambiguousSeeds）。 */
  readonly ambiguousSeeds: readonly string[]
}

// ── 知识库（0207：KB 一等实体）──────────────────────────────────────────────

export type KbManaged = 'user' | 'config'

export interface KnowledgeBase {
  /** 存储目录名（slug 化 + 去重）。 */
  readonly id: string
  /** 用户可读名，注册表内唯一（大小写不敏感匹配）。 */
  readonly name: string
  /** 授权目录（realpath 前缀校验在索引时执行）。 */
  readonly roots: readonly string[]
  readonly description: string | null
  /** config 声明的库由补丁托管（Web 只读），user 库由面板/工具创建。 */
  readonly managed: KbManaged
  readonly createdAt: number
  readonly lastIndexedAt: number | null
}

// ── 索引进度（0207 §3.2 面板数据源）────────────────────────────────────────

export type IndexPhase = 'scanning' | 'extracting' | 'communities' | 'summarizing' | 'done' | 'error'

export interface IndexProgress {
  readonly kbId: string
  readonly kbName: string
  readonly phase: IndexPhase
  readonly filesDone: number
  readonly filesTotal: number
  readonly currentFile: string | null
  readonly llmCalls: number
  readonly tokensIn: number
  readonly tokensOut: number
  readonly quarantined: number
  readonly startedAt: number
  readonly finishedAt: number | null
  readonly error: string | null
  readonly report: IndexReport | null
}

// ── 治理面 ───────────────────────────────────────────────────────────────────

export interface IndexStatus {
  readonly provider: string
  /** 解析到的 KB 名（总览模式为 null）。 */
  readonly kbName: string | null
  readonly files: {
    readonly indexed: number
    readonly stale: number
    readonly quarantined: number
    readonly skippedBinary: number
  }
  readonly graph: {
    readonly entities: number
    readonly relations: number
    readonly communities: number
  }
  readonly lastIndexAt: number | null
  readonly staleness: { readonly changedSinceIndex: number }
  readonly llmAvailable: boolean
  /** 总览模式（未指定 kb）：全部 KB 概览。 */
  readonly kbsOverview: readonly {
    readonly name: string
    readonly filesIndexed: number
    readonly entities: number
    readonly lastIndexAt: number | null
  }[]
}

export interface IndexReport {
  readonly files: {
    readonly new: number
    readonly changed: number
    readonly deleted: number
    readonly skipped: number
  }
  readonly graphDelta: {
    readonly entitiesAdded: number
    readonly relationsAdded: number
    readonly communitiesRebuilt: number
    readonly summariesRecomputed: number
  }
  readonly cost: { readonly llmCalls: number; readonly tokensIn: number; readonly tokensOut: number }
  readonly quarantined: number
  readonly aborted: boolean
}

export type ForgetTarget =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'entity'; readonly name: string }
  | { readonly kind: 'graph' }

export interface ForgetReport {
  readonly deleted: {
    readonly chunks: number
    readonly mentions: number
    readonly relations: number
    readonly entities: number
    readonly summaries: number
  }
  readonly communitiesRebuilt: number
}

// ── 稳定错误码（0204 §5）────────────────────────────────────────────────────

export const ERROR_CODES = [
  'NOT_AUTHORIZED',
  'NOT_INDEXED',
  'INDEX_IN_PROGRESS',
  'NO_SEED',
  'AMBIGUOUS_SEED',
  'KB_AMBIGUOUS',
  'INVALID',
  'QUARANTINED',
  'NO_PROVIDER',
  'MISSING_CREDENTIAL',
  'ABORTED',
  'LLM_TIMEOUT',
  'CONTEXT_WINDOW',
  'SCHEMA_FUTURE',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export class GraphRagError extends Error {
  constructor(readonly code: ErrorCode, message: string) {
    super(`[${code}] ${message}`)
    this.name = 'GraphRagError'
  }
}
