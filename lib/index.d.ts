/** 薄类型面（0205 §4「或手写薄 d.ts」）：外部插件消费的 seam 契约。
 * 完整领域类型见 src/core/types.ts；本文件保持手写薄层，不随内部演进而
 * 要求重新生成——重负载（EvidencePack 等）以结构最小形态声明。
 */

export interface KbRef {
  readonly id?: string
  readonly name?: string
}

export interface KnowledgeBase {
  readonly id: string
  readonly name: string
  readonly roots: readonly string[]
  readonly description: string | null
  readonly managed: 'user' | 'config'
  readonly createdAt: number
  readonly lastIndexedAt: number | null
}

export interface IndexOptions {
  readonly roots?: readonly string[]
  readonly retryQuarantined?: boolean
}

export interface QueryInput {
  readonly question: string
  readonly mode: 'local' | 'global'
  readonly maxTokens?: number
  readonly topK?: number
}

export interface TraverseInput {
  readonly seed: string
  readonly direction?: 'out' | 'in' | 'both'
  readonly hops?: number
  readonly relationTypes?: readonly string[]
  readonly maxNodes?: number
}

/** 证据包（结构最小形态）：分层 = 结构理解层（entities/relations/communities，
 * 二手）+ 原文证据层（chunks，一级，path+lines 举证）。 */
export interface EvidencePack {
  readonly mode: 'local' | 'global'
  readonly question: string
  readonly entities: readonly { readonly name: string; readonly type: string; readonly description: string | null; readonly community: string | null }[]
  readonly relations: readonly { readonly s: string; readonly r: string; readonly o: string; readonly w: number; readonly evidence: readonly { readonly path: string; readonly lines: string }[] }[]
  readonly chunks: readonly { readonly path: string; readonly lines: string; readonly text: string; readonly score: number | null }[]
  readonly communities: readonly { readonly summary: string; readonly top: readonly string[] }[]
  readonly meta: { readonly mode: string; readonly llmCalls: number; readonly [k: string]: unknown }
}

export interface Subgraph {
  readonly seed: string
  readonly direction: 'out' | 'in' | 'both'
  readonly hops: number
  readonly nodes: readonly { readonly id: number; readonly name: string; readonly type: string; readonly degree: number }[]
  readonly edges: readonly { readonly s: string; readonly r: string; readonly o: string; readonly w: number; readonly evidence: readonly { readonly path: string; readonly lines: string }[] }[]
  readonly truncated: boolean
  readonly ambiguousSeeds: readonly string[]
}

export interface IndexStatus {
  readonly provider: string
  readonly kbName: string | null
  readonly files: { readonly indexed: number; readonly stale: number; readonly quarantined: number; readonly skippedBinary: number }
  readonly graph: { readonly entities: number; readonly relations: number; readonly communities: number }
  readonly lastIndexAt: number | null
  readonly staleness: { readonly changedSinceIndex: number }
  readonly llmAvailable: boolean
  readonly kbsOverview: readonly { readonly name: string; readonly filesIndexed: number; readonly entities: number; readonly lastIndexAt: number | null }[]
}

export interface IndexReport {
  readonly files: { readonly new: number; readonly changed: number; readonly deleted: number; readonly skipped: number }
  readonly graphDelta: { readonly entitiesAdded: number; readonly relationsAdded: number; readonly communitiesRebuilt: number; readonly summariesRecomputed: number }
  readonly cost: { readonly llmCalls: number; readonly tokensIn: number; readonly tokensOut: number }
  readonly quarantined: number
  readonly aborted: boolean
}

export type ForgetTarget =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'entity'; readonly name: string }
  | { readonly kind: 'graph' }

export interface ForgetReport {
  readonly deleted: { readonly chunks: number; readonly mentions: number; readonly relations: number; readonly entities: number; readonly summaries: number }
  readonly communitiesRebuilt: number
}

/** provider v2（0207 §2.2）：KB 管理面 + 检索面 + 浏览/审查面。
 * 面板专用方法（browse/sample/review/health/knowledge 管理）以结构最小形态
 * 声明；sessionId 用于抽取模型跟随触发会话。 */
export interface GraphRagProvider {
  readonly id: string
  listKbs(): readonly KnowledgeBase[]
  createKb(input: { readonly name: string; readonly roots: readonly string[]; readonly description?: string }): KnowledgeBase
  updateKb(id: string, patch: { readonly name?: string; readonly roots?: readonly string[]; readonly description?: string | null }): KnowledgeBase
  deleteKb(id: string): ForgetReport
  status(target?: KbRef): Promise<IndexStatus>
  index(target: KbRef, opts: IndexOptions, signal: AbortSignal, sessionId?: string): Promise<IndexReport>
  indexBackground(target: KbRef, opts: IndexOptions, sessionId?: string): { readonly started: boolean }
  progress(kbId: string): { readonly [k: string]: unknown } | null
  cancelIndex(kbId: string): boolean
  query(target: KbRef | undefined, q: QueryInput, cwd?: string): Promise<EvidencePack>
  traverse(target: KbRef | undefined, t: TraverseInput, cwd?: string): Promise<Subgraph>
  forget(target: KbRef | undefined, inner: ForgetTarget, cwd?: string): Promise<ForgetReport>
  estimate(target: KbRef | undefined, opts: IndexOptions, cwd?: string): { readonly files: number; readonly estCalls: number }
  [key: string]: unknown
}

export interface GraphRagService {
  /** 注册 provider；同 id 重复注册抛错。返回注销函数。 */
  register(provider: GraphRagProvider): () => void
  /** 顺序无关选择：恰一个 → 选中；多个 → 需 pin；零个 → 抛错。 */
  resolve(pin?: string): GraphRagProvider
}

export declare const name: string
export declare const inject: readonly []
export declare function apply(ctx: unknown, config?: { readonly provider?: string }): void
