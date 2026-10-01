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
}

export interface TraverseInput {
  readonly seed: string
  readonly direction?: 'out' | 'in' | 'both'
  readonly hops?: number
  readonly relationTypes?: readonly string[]
  readonly maxNodes?: number
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
