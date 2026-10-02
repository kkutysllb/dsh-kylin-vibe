/** Seam：GraphRagService 契约 + provider 注册表（docs/02-design/0201 §2/§4）。
 *
 * 三角色中的 Service Definition：只拥有 `ctx.graphrag` 注册表与顺序无关
 * 选择；provider（./provider.ts）与 consumer（./tool.ts，M2-W2）只依赖
 * 本 seam，互不依赖——替换引擎 = 换 patch 一行（ADR-7）。
 *
 * 宿主挂载说明：直接属性挂载 + ctx.effect 清理（零运行时导入纪律）。
 * 与宿主 TypertRemoteService 服务基类的对齐在 M2-W3 真实宿主冒烟中
 * 验证，必要时替换挂载方式（风险已记 0301）。
 */

import type { Context } from '@deepseek-ai/cordis'

import { GraphRagError, type EvidencePack, type ForgetReport, type ForgetTarget, type IndexReport, type IndexStatus, type Subgraph } from './core/types.ts'

// ── 服务契约（0201 §4 + 0207 v2：多知识库）──────────────────────────────────

/** KB 定位：id 或 name 任一；undefined = 默认解析链（cwd 命中唯一库 / 唯一库）。 */
export interface KbRef {
  readonly id?: string
  readonly name?: string
}

export interface IndexOptions {
  /** 本次索引的已授权子路径；缺省 = KB roots 全部。 */
  readonly roots?: readonly string[]
  /** 同时重放隔离区（0204 §2.4）。 */
  readonly retryQuarantined?: boolean
}

export interface QueryInput {
  readonly question: string
  readonly mode: 'local' | 'global'
  readonly maxTokens?: number
  /** 召回测试：证据 chunk 数上限（local，默认 12，钳 5..50）。 */
  readonly topK?: number
}

export interface TraverseInput {
  readonly seed: string
  readonly direction?: 'out' | 'in' | 'both'
  readonly hops?: number
  readonly relationTypes?: readonly string[]
  readonly maxNodes?: number
}

/** 浏览页实体卡（含邻居边）。 */
export interface EntityCard {
  readonly id: number
  readonly name: string
  readonly type: string
  readonly description: string | null
  readonly degree: number
  readonly communityId: number | null
  readonly neighbors: readonly EntityNeighbor[]
}

export interface EntityNeighbor {
  readonly dir: 'out' | 'in'
  readonly type: string
  readonly weight: number
  readonly other: string
  /** 对端实体（图谱视图需要真实 id 与类型配色）。 */
  readonly otherId: number
  readonly otherType: string
  readonly evidence: readonly { readonly path: string; readonly lines: string }[]
}

/** 审查页抽样关系卡。 */
export interface ReviewSample {
  readonly id: number
  readonly s: string
  readonly r: string
  readonly o: string
  readonly confidence: number
  readonly evidence: readonly { readonly path: string; readonly startLine: number; readonly endLine: number; readonly text: string }[]
}

/** 体检报告（0207 §3.4 结论卡）。 */
export interface HealthReport {
  readonly kbName: string
  readonly files: { readonly indexed: number; readonly stale: number; readonly quarantined: number }
  readonly coverage: number | null
  readonly quarantineRate: number | null
  readonly sampled: number
  readonly correct: number
  readonly corrected: number
  readonly samplePrecision: number | null
  readonly excludedRelations: number
  readonly lastIndexAt: number | null
}

export interface GraphRagProvider {
  readonly id: string
  // ── KB 管理面（0207 §2.2）──
  listKbs(): readonly import('./core/types.ts').KnowledgeBase[]
  createKb(input: { readonly name: string; readonly roots: readonly string[]; readonly description?: string }): import('./core/types.ts').KnowledgeBase
  updateKb(id: string, patch: { readonly name?: string; readonly roots?: readonly string[]; readonly description?: string | null }): import('./core/types.ts').KnowledgeBase
  deleteKb(id: string): ForgetReport
  // ── 检索面（status 不传 target = 总览；query/traverse 缺省 = 默认解析链，
  // cwd 参与解析：caller 工作区命中唯一 KB 的 roots 时自动选中）──
  status(target?: KbRef): Promise<IndexStatus>
  index(target: KbRef, opts: IndexOptions, signal: AbortSignal): Promise<IndexReport>
  /** 面板触发的后台索引：立即返回（同库互斥），进度经 progress() 轮询。 */
  indexBackground(target: KbRef, opts: IndexOptions): { readonly started: boolean }
  progress(kbId: string): import('./core/types.ts').IndexProgress | null
  cancelIndex(kbId: string): boolean
  query(target: KbRef | undefined, q: QueryInput, cwd?: string): Promise<EvidencePack>
  traverse(target: KbRef | undefined, t: TraverseInput, cwd?: string): Promise<Subgraph>
  forget(target: KbRef | undefined, inner: ForgetTarget, cwd?: string): Promise<ForgetReport>
  /** 审批卡 dry-run 成本估算（0204 §3）：将处理的脏文件数与预计 LLM 调用。
   * 同步实现（scan+diff 纯本地）。 */
  estimate(target: KbRef | undefined, opts: IndexOptions, cwd?: string): { readonly files: number; readonly estCalls: number }
  // ── 浏览与审查面（0207 §3.3/§3.4，面板专用）──
  browseEntities(target: KbRef, query: string, limit: number): readonly EntityCard[]
  sampleForReview(target: KbRef, limit: number): readonly ReviewSample[]
  /** 已入库来源清单（面板知识管理，含统计/类型/时间）。 */
  listKnowledge(target: KbRef): readonly {
    readonly path: string; readonly absPath: string; readonly state: string; readonly isNote: boolean
    readonly ext: string; readonly mtimeMs: number; readonly error: string | null
    readonly stats: { readonly chunks: number; readonly entities: number; readonly relations: number }
  }[]
  /** 补充新知识：粘贴文本落为笔记文件并后台增量索引。 */
  addTextKnowledge(target: KbRef, title: string, text: string): { readonly file: string; readonly started: boolean }
  /** 删除旧知识：按文件级联清除；笔记文件同时删物理文件。 */
  forgetKnowledge(target: KbRef, path: string): Promise<{ readonly deleted: { chunks: number; relations: number; entities: number } }>
  /** 单文件重新索引（其余皆终态，只续跑它）。 */
  reindexKnowledge(target: KbRef, path: string): { readonly started: boolean }
  /** 停用/启用来源：停用=排除检索不删数据；启用=置回待索引并自动续跑。 */
  setKnowledgeEnabled(target: KbRef, path: string, enabled: boolean): { readonly started: boolean }
  /** 文件导入：选择器路径复制进导入区并后台索引（授权=用户显式挑选）。 */
  importFiles(target: KbRef, paths: readonly string[]): { readonly imported: number; readonly skipped: readonly { readonly path: string; readonly reason: string }[]; readonly started: boolean }
  /** 目录导入：所选目录下的常规文件（非递归、跳过隐藏）复制进导入区并索引。 */
  importDirectory(target: KbRef, dir: string): { readonly imported: number; readonly skipped: readonly { readonly path: string; readonly reason: string }[]; readonly started: boolean }
  /** 变更同步预览：扫描 diff（零 LLM），供面板"有变更"提示。 */
  changesPreview(target: KbRef): { readonly added: number; readonly changed: readonly string[]; readonly removed: readonly string[] }
  /** 图谱视图增量展开：返回节点一跳邻居与边（Neo4j Browser 模式）。 */
  expandNode(target: KbRef, nodeId: number): {
    readonly node: { readonly id: number; readonly name: string; readonly type: string; readonly degree: number } | null
    readonly neighbors: readonly { readonly id: number; readonly name: string; readonly type: string; readonly degree: number }[]
    readonly edges: readonly { readonly s: number; readonly t: number; readonly type: string; readonly weight: number; readonly evidence: string }[]
  }
  /** 选区更正建议：对滑选原文跑 SPO 抽取返回候选三元组（面板更正预填）。 */

  correctFromSelection(target: KbRef | undefined, text: string): Promise<{ readonly triples: ReadonlyArray<{ s: string; r: string; o: string }> }>
  reviewRelation(
    target: KbRef,
    relationId: number,
    verdict: 'correct' | 'wrong' | 'unsure',
    correction?: { readonly s?: string; readonly r?: string; readonly o?: string },
  ): { readonly excluded: boolean; readonly corrected: boolean }
  healthReport(target: KbRef): HealthReport
}

export interface GraphRagService {
  /** 注册 provider；同 id 重复注册抛错（DUPLICATE 语义）。返回注销函数。 */
  register(provider: GraphRagProvider): () => void
  /** 顺序无关选择：恰一个 → 选中；多个 → 需 pin；零个 → NO_PROVIDER。 */
  resolve(pin?: string): GraphRagProvider
}

// ── 实现 ─────────────────────────────────────────────────────────────────────

export class GraphRagServiceImpl implements GraphRagService {
  private readonly providers = new Map<string, GraphRagProvider>()

  register(provider: GraphRagProvider): () => void {
    if (this.providers.has(provider.id)) {
      throw new GraphRagError('NO_PROVIDER', `provider 重复注册：${provider.id}`)
    }
    this.providers.set(provider.id, provider)
    return () => { this.providers.delete(provider.id) }
  }

  resolve(pin?: string): GraphRagProvider {
    if (pin !== undefined && pin !== '') {
      const p = this.providers.get(pin)
      if (p === undefined) throw new GraphRagError('NO_PROVIDER', `未注册的 provider：${pin}`)
      return p
    }
    if (this.providers.size === 1) return [...this.providers.values()][0] as GraphRagProvider
    if (this.providers.size === 0) {
      throw new GraphRagError('NO_PROVIDER', '没有已注册的 GraphRAG provider')
    }
    const ids = [...this.providers.keys()].join(', ')
    throw new GraphRagError('NO_PROVIDER', `多个 provider（${ids}），需在配置中指定 graphrag.provider pin`)
  }
}

// ── 插件入口 ─────────────────────────────────────────────────────────────────

export const name = 'dsh-kylin-vibe'

/** 零依赖（0.2.0 宿主实测：inject 必须是纯数组名，对象形式被当作服务名
 * 字面量导致 pending）。数据目录由 provider 配置决定，不经 storageDomain。 */
export const inject = [] as const

export interface SeamConfig {
  /** pin 的 provider id（多 provider 时必须）。 */
  readonly provider?: string
}

export function apply(ctx: Context, config: SeamConfig = {}): void {
  const service = new GraphRagServiceImpl()
  // 0.2.0 宿主实测：直接属性赋值抛 "cannot set property without provide"；
  // 必须经 reflect.provide 注册（返回 disposer，随 fiber 卸载自动清理）。
  ctx.reflect!.provide('graphrag', service)
  void config
}
