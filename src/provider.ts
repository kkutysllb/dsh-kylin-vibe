/** 本地引擎 Provider v2（docs/02-design/0207）：多知识库 + 宿主 llm 惰性解析。
 *
 * 职责边界：KB 注册表（kbs.json）、按库隔离的 SQLite store、配置声明合并、
 * 降级矩阵（无 llm：词法/遍历可用，抽取/摘要/索引返回 NO_PROVIDER）。
 * 不触碰工具面（tool.ts）。
 */

import { mkdirSync, realpathSync, rmSync } from 'node:fs'

import { llmCompleterOf, llmServiceOf, resolveDataDir } from './adapter.ts'
import type { ChunkOptions } from './core/chunker.ts'
import type { LlmCompleter } from './core/extractor.ts'
import { runIngest, type CommunitySummarizer, type IngestConfig } from './core/ingest.ts'
import { KbRegistry, migrateLegacyWorkspaces } from './core/kb.ts'
import { SqliteGraphStore } from './core/graphstore.ts'
import { diffAgainstIndex, scanRoots } from './core/scanner.ts'
import { searchGlobal, searchLocal, searchTraversal } from './core/search.ts'
import {
  GraphRagError,
  type EvidencePack, type ForgetReport, type ForgetTarget, type IndexProgress,
  type KnowledgeBase, type IndexReport, type IndexStatus, type Subgraph,
} from './core/types.ts'
import type { Context } from '@deepseek-ai/cordis'
import { GraphRagServiceImpl, type GraphRagProvider, type IndexOptions, type QueryInput, type TraverseInput } from './index.ts'

// ── KB 引用 ──────────────────────────────────────────────────────────────────

/** 工具/面板侧的 KB 定位：id 或 name 任一；缺省走默认解析链（0207 §2.2）。 */
export interface KbRef {
  readonly id?: string
  readonly name?: string
}

// ── 配置（0205 §7 / 0207 §2：防御性钳制）───────────────────────────────────

export interface ProviderConfigInput {
  /** patch 行 config 是普通对象：字段按 unknown 防御钳制。 */
  readonly roots?: readonly unknown[]
  readonly excludes?: readonly unknown[]
  readonly dataDir?: string
  readonly model?: { readonly provider?: unknown; readonly model?: unknown; readonly maxTokens?: number } | null
  readonly extract?: { readonly minConfidence?: number; readonly repairRetries?: number }
  readonly community?: { readonly recomputeThreshold?: number }
  readonly chunk?: ChunkOptions
  readonly retry?: { readonly rateLimitRetries?: number; readonly baseDelayMs?: number }
  /** 配置声明的知识库（托管库：面板只读）。 */
  readonly kbs?: readonly {
    readonly name?: unknown
    readonly roots?: readonly unknown[]
    readonly description?: unknown
  }[]
}

export interface ProviderConfig {
  readonly excludes?: readonly string[]
  readonly dataDir: string
  readonly model: { readonly provider: string; readonly model: string; readonly maxTokens?: number } | null
  readonly extract: { readonly minConfidence: number; readonly repairRetries: number }
  readonly community: { readonly recomputeThreshold: number }
  readonly chunk?: ChunkOptions
  readonly retry: { readonly rateLimitRetries: number; readonly baseDelayMs: number }
}

/** patch 行 config 是普通对象：逐字段防御钳制（学 automation Config 处理）。 */
export function clampConfig(raw: ProviderConfigInput, env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const model = raw.model != null
    && typeof raw.model.provider === 'string' && raw.model.provider !== ''
    && typeof raw.model.model === 'string' && raw.model.model !== ''
    ? { provider: raw.model.provider, model: raw.model.model, maxTokens: raw.model.maxTokens }
    : null
  return {
    excludes: Array.isArray(raw.excludes) ? raw.excludes.filter((x): x is string => typeof x === 'string') : undefined,
    dataDir: resolveDataDir(typeof raw.dataDir === 'string' ? raw.dataDir : undefined, env),
    model,
    extract: {
      minConfidence: clampNum(raw.extract?.minConfidence, 0.1, 1, 0.6),
      repairRetries: Math.trunc(clampNum(raw.extract?.repairRetries, 0, 2, 1)),
    },
    community: { recomputeThreshold: clampNum(raw.community?.recomputeThreshold, 0, 1, 0.05) },
    chunk: raw.chunk,
    retry: {
      rateLimitRetries: Math.trunc(clampNum(raw.retry?.rateLimitRetries, 0, 5, 3)),
      baseDelayMs: Math.trunc(clampNum(raw.retry?.baseDelayMs, 0, 30_000, 500)),
    },
  }
}

function clampNum(v: unknown, min: number, max: number, dflt: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt
}

/** 配置声明的 KB（托管）：名称/roots 逐项钳制，非法项跳过。 */
export function declaredKbsOf(raw: ProviderConfigInput): { name: string; roots: string[]; description: string | null }[] {
  const out: { name: string; roots: string[]; description: string | null }[] = []
  if (!Array.isArray(raw.kbs)) return out
  for (const k of raw.kbs) {
    const name = typeof k?.name === 'string' && k.name.trim() !== '' ? k.name.trim() : null
    const roots = Array.isArray(k?.roots)
      ? (k.roots as readonly unknown[]).filter((r: unknown): r is string => typeof r === 'string' && r !== '')
      : []
    if (name === null || roots.length === 0) continue
    out.push({ name, roots, description: typeof k?.description === 'string' ? k.description : null })
  }
  return out
}

// ── 社区摘要（0203 §1.8 prompt 契约）───────────────────────────────────────

function summarizerOf(llm: LlmCompleter): CommunitySummarizer {
  return async ({ members, topEdges }) => {
    const memberText = members.map(m => `${m.name}（${m.type}）${m.description ?? ''}`).join('\n')
    const edgeText = topEdges.map(e => `${e.s} -[${e.r}]-> ${e.o}`).join('\n')
    const out = await llm.complete(
      '你是知识库摘要器。基于以下实体、关系与描述，生成 ≤150 字的社区主题摘要：该社区代表什么、内部主要关系、与外部的边界。仅输出 JSON：{"summary":"...","top":["代表实体名", ...]}',
      `实体：\n${memberText}\n\n关系：\n${edgeText}`,
    )
    try {
      const parsed = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as { summary?: unknown }
      const summary = typeof parsed.summary === 'string' ? parsed.summary : out
      return summary
    } catch {
      return out // 解析失败退回原文（摘要层容忍降级）
    }
  }
}

// ── Provider 实现 ────────────────────────────────────────────────────────────

export interface LocalProviderDeps {
  /** 宿主 ctx（用于 llm 非严格读取）；无 llm 时传 null 进降级矩阵。 */
  readonly ctx: Context | null
  /** 直注 completer（测试/嵌入用；优先于 ctx.llm 路由）。 */
  readonly llm?: LlmCompleter | null
}

export class LocalGraphRagProvider implements GraphRagProvider {
  readonly id = 'local-sqlite'
  private readonly registry: KbRegistry
  private readonly stores = new Map<string, SqliteGraphStore>()
  private readonly directLlm: LlmCompleter | null
  private cachedLlm: LlmCompleter | null | undefined

  constructor(private readonly config: ProviderConfig, private readonly deps: LocalProviderDeps, declared: readonly { name: string; roots: string[]; description: string | null }[] = []) {
    this.directLlm = deps.llm ?? null
    this.cachedLlm = this.directLlm !== null ? this.directLlm : undefined
    mkdirSync(config.dataDir, { recursive: true })
    this.registry = KbRegistry.load(config.dataDir)
    migrateLegacyWorkspaces(config.dataDir, this.registry, declared[0]?.roots ?? [])
    for (const d of declared) {
      if (this.registry.byName(d.name) === undefined) {
        this.registry.create({ name: d.name, roots: d.roots, description: d.description }, 'config')
      }
    }
  }

  /** 调用时惰性解析（0.2.0 宿主实测：未 inject 的服务属性访问会抛错，
   * 必须走 reflect.get 非严格读取；且插件 apply 可能早于 llm provide）。 */
  private completer(): LlmCompleter | null {
    if (this.cachedLlm !== undefined) return this.cachedLlm
    const ctx = this.deps.ctx
    const model = this.config.model
    const llmService = ctx === null ? null : llmServiceOf(ctx)
    if (model === null || llmService === null || ctx === null) {
      this.cachedLlm = null
      return null
    }
    this.cachedLlm = llmCompleterOf(ctx, model, this.config.retry)
    return this.cachedLlm
  }

  // ── KB 管理面 ─────────────────────────────────────────────────────────────

  listKbs(): readonly KnowledgeBase[] {
    return this.registry.list()
  }

  createKb(input: { readonly name: string; readonly roots: readonly string[]; readonly description?: string }): KnowledgeBase {
    const kb = this.registry.create({ name: input.name, roots: input.roots, description: input.description ?? null }, 'user')
    mkdirSync(this.kbDir(kb.id), { recursive: true })
    return kb
  }

  updateKb(id: string, patch: { readonly name?: string; readonly roots?: readonly string[]; readonly description?: string | null }): KnowledgeBase {
    return this.registry.update(id, patch)
  }

  deleteKb(id: string): ForgetReport {
    const before = this.storeById(id).counts()
    this.stores.get(id)?.close()
    this.stores.delete(id)
    rmSync(this.kbDir(id), { recursive: true, force: true })
    this.registry.remove(id)
    return {
      deleted: {
        chunks: before.chunks, mentions: before.mentions, relations: before.relations,
        entities: before.entities, summaries: before.summaries,
      },
      communitiesRebuilt: before.communities,
    }
  }

  /** KB 解析链（0207 §2.2）：id → name → cwd 命中唯一库 → 唯一库；否则候选。 */
  resolveKb(ref: KbRef | undefined, cwd?: string): KnowledgeBase {
    if (ref?.id !== undefined && ref.id !== '') {
      const kb = this.registry.byId(ref.id)
      if (kb === undefined) throw new GraphRagError('KB_AMBIGUOUS', `未找到知识库 id：${ref.id}；可用：${this.kbNames()}`)
      return kb
    }
    if (ref?.name !== undefined && ref.name !== '') {
      const kb = this.registry.byName(ref.name)
      if (kb === undefined) throw new GraphRagError('KB_AMBIGUOUS', `未找到知识库：${ref.name}；可用：${this.kbNames()}`)
      return kb
    }
    const all = this.registry.list()
    if (all.length === 1) return all[0] as KnowledgeBase
    if (cwd !== undefined) {
      let cwdReal = cwd
      try { cwdReal = realpathSync(cwd) } catch { /* 保持原值 */ }
      const byCwd = this.registry.byCwd(cwdReal)
      if (byCwd !== undefined) return byCwd
    }
    if (all.length === 0) throw new GraphRagError('NOT_INDEXED', '尚无任何知识库；先在面板创建，或调用 graphrag_index（kb + create）')
    throw new GraphRagError('KB_AMBIGUOUS', `存在多个知识库，请指定 kb：${this.kbNames()}`)
  }

  private kbNames(): string {
    return this.registry.list().map(k => k.name).join(' / ') || '（无）'
  }

  // ── 按库存储 ──────────────────────────────────────────────────────────────

  private kbDir(kbId: string): string {
    return `${this.config.dataDir}/kbs/${kbId}`
  }

  private storeById(kbId: string): SqliteGraphStore {
    const existing = this.stores.get(kbId)
    if (existing) return existing
    const dir = this.kbDir(kbId)
    mkdirSync(dir, { recursive: true })
    const store = new SqliteGraphStore(`${dir}/graphrag.db`)
    this.stores.set(kbId, store)
    return store
  }

  private storeOf(kb: KnowledgeBase): SqliteGraphStore {
    return this.storeById(kb.id)
  }

  dispose(): void {
    for (const s of this.stores.values()) s.close()
    this.stores.clear()
  }

  // ── 后台索引与进度（0207 §3.2 面板数据源）─────────────────────────────

  private readonly progressRecords = new Map<string, IndexProgress>()
  private readonly controllers = new Map<string, AbortController>()

  /** 面板触发的后台索引：立即返回，进度经 progress() 轮询。同库互斥。 */
  indexBackground(target: KbRef, opts: IndexOptions): { readonly started: boolean } {
    const kb = this.resolveKb(target)
    const running = this.progressRecords.get(kb.id)
    if (running !== undefined && running.phase !== 'done' && running.phase !== 'error') {
      return { started: false }
    }
    if (kb.roots.length === 0) {
      throw new GraphRagError('NOT_AUTHORIZED', `知识库「${kb.name}」未配置授权 roots；请在面板或配置中添加`)
    }
    const llm = this.completer()
    if (llm === null) {
      throw new GraphRagError('NO_PROVIDER', '模型 provider 不可用（宿主未配置 llm 或插件未配置 model）')
    }
    const store = this.storeOf(kb)
    if (opts.retryQuarantined) {
      for (const s of store.listSources()) {
        if (s.state === 'quarantined') store.setSourceState(s.id, 'pending')
      }
      for (const q of store.quarantineList()) store.quarantineResolve(q.id)
    }
    const record: { -readonly [K in keyof IndexProgress]: IndexProgress[K] } = {
      kbId: kb.id, kbName: kb.name, phase: 'scanning',
      filesDone: 0, filesTotal: 0, currentFile: null,
      llmCalls: 0, tokensIn: 0, tokensOut: 0, quarantined: 0,
      startedAt: Date.now(), finishedAt: null, error: null, report: null,
    }
    this.progressRecords.set(kb.id, record)
    const controller = new AbortController()
    this.controllers.set(kb.id, controller)
    const cfg: IngestConfig = {
      authorizedRoots: [...kb.roots],
      roots: opts.roots,
      excludes: this.config.excludes,
      chunk: this.config.chunk,
      extract: this.config.extract,
      community: this.config.community,
    }
    void runIngest(store, cfg, { llm, summarize: summarizerOf(llm) }, controller.signal, p => {
      record.phase = p.phase
      record.filesDone = p.filesDone
      record.filesTotal = p.filesTotal
      record.currentFile = p.currentFile ?? null
      record.quarantined = p.quarantined
    }).then(report => {
      record.phase = 'done'
      record.report = report
      record.finishedAt = Date.now()
      store.setMeta('last-index-at', String(record.finishedAt))
      this.registry.touchIndexed(kb.id, record.finishedAt)
    }).catch(err => {
      record.phase = 'error'
      record.error = err instanceof Error ? err.message : String(err)
      record.finishedAt = Date.now()
    }).finally(() => {
      this.controllers.delete(kb.id)
    })
    return { started: true }
  }

  progress(kbId: string): IndexProgress | null {
    return this.progressRecords.get(kbId) ?? null
  }

  cancelIndex(kbId: string): boolean {
    const controller = this.controllers.get(kbId)
    if (controller === undefined) return false
    controller.abort()
    return true
  }

  // ── 状态（单库 / 总览）────────────────────────────────────────────────────

  private statusOf(kb: KnowledgeBase): IndexStatus {
    const store = this.storeOf(kb)
    const sources = store.listSources()
    const c = store.counts()
    return {
      provider: this.id,
      kbName: kb.name,
      files: {
        indexed: sources.filter(s => s.state === 'merged').length,
        stale: sources.filter(s => s.state !== 'merged' && s.state !== 'deleted').length,
        quarantined: sources.filter(s => s.state === 'quarantined').length,
        skippedBinary: sources.filter(s => s.error === 'skipped-binary').length,
      },
      graph: { entities: c.entities, relations: c.relations, communities: c.communities },
      lastIndexAt: kb.lastIndexedAt,
      staleness: { changedSinceIndex: sources.filter(s => s.state === 'pending' || s.state === 'extracting').length },
      llmAvailable: this.completer() !== null,
      kbsOverview: [],
    }
  }

  async status(target?: KbRef): Promise<IndexStatus> {
    if (target !== undefined && (target.id !== undefined || target.name !== undefined)) {
      return this.statusOf(this.resolveKb(target))
    }
    // 总览：聚合计数 + 每库概览（0204 v2：不传 kb = 列出全部 KB）
    const kbs = this.registry.list()
    let indexed = 0
    let stale = 0
    let quarantined = 0
    let skipped = 0
    let entities = 0
    let relations = 0
    let communities = 0
    const overview = kbs.map(kb => {
      const store = this.storeOf(kb)
      const sources = store.listSources()
      const c = store.counts()
      const kbIndexed = sources.filter(s => s.state === 'merged').length
      indexed += kbIndexed
      stale += sources.filter(s => s.state !== 'merged' && s.state !== 'deleted').length
      quarantined += sources.filter(s => s.state === 'quarantined').length
      skipped += sources.filter(s => s.error === 'skipped-binary').length
      entities += c.entities
      relations += c.relations
      communities += c.communities
      return { name: kb.name, filesIndexed: kbIndexed, entities: c.entities, lastIndexAt: kb.lastIndexedAt }
    })
    return {
      provider: this.id, kbName: null,
      files: { indexed, stale, quarantined, skippedBinary: skipped },
      graph: { entities, relations, communities },
      lastIndexAt: null,
      staleness: { changedSinceIndex: 0 },
      llmAvailable: this.completer() !== null,
      kbsOverview: overview,
    }
  }

  // ── 索引 / 查询 / 遍历 / 遗忘 ─────────────────────────────────────────────

  async index(target: KbRef, opts: IndexOptions, signal: AbortSignal): Promise<IndexReport> {
    const kb = this.resolveKb(target)
    if (kb.roots.length === 0) {
      throw new GraphRagError('NOT_AUTHORIZED', `知识库「${kb.name}」未配置授权 roots；请在面板或配置中添加`)
    }
    const llm = this.completer()
    if (llm === null) {
      throw new GraphRagError('NO_PROVIDER', '模型 provider 不可用（宿主未配置 llm 或插件未配置 model）；词法检索与遍历不受影响')
    }
    const store = this.storeOf(kb)
    if (opts.retryQuarantined) {
      for (const s of store.listSources()) {
        if (s.state === 'quarantined') store.setSourceState(s.id, 'pending')
      }
      for (const q of store.quarantineList()) store.quarantineResolve(q.id)
    }
    const cfg: IngestConfig = {
      authorizedRoots: [...kb.roots],
      roots: opts.roots,
      excludes: this.config.excludes,
      chunk: this.config.chunk,
      extract: this.config.extract,
      community: this.config.community,
    }
    const report = await runIngest(store, cfg, { llm, summarize: summarizerOf(llm) }, signal)
    const finished = Date.now()
    store.setMeta('last-index-at', String(finished))
    this.registry.touchIndexed(kb.id, finished)
    return report
  }

  async query(target: KbRef | undefined, q: QueryInput): Promise<EvidencePack> {
    const kb = this.resolveKb(target)
    const store = this.storeOf(kb)
    if (store.counts().sources === 0) {
      throw new GraphRagError('NOT_INDEXED', `知识库「${kb.name}」尚未建立图谱；先调用 graphrag_index（需审批）`)
    }
    if (q.mode === 'global') return searchGlobal(store, q.question, { maxTokens: q.maxTokens })
    return searchLocal(store, q.question, { maxTokens: q.maxTokens })
  }

  async traverse(target: KbRef | undefined, t: TraverseInput): Promise<Subgraph> {
    const kb = this.resolveKb(target)
    const store = this.storeOf(kb)
    if (store.counts().sources === 0) {
      throw new GraphRagError('NOT_INDEXED', `知识库「${kb.name}」尚未建立图谱；先调用 graphrag_index（需审批）`)
    }
    return searchTraversal(store, t.seed, t)
  }

  async forget(target: KbRef, inner: ForgetTarget): Promise<ForgetReport> {
    return this.storeOf(this.resolveKb(target)).forget(inner)
  }

  estimate(target: KbRef | undefined, opts: IndexOptions): { readonly files: number; readonly estCalls: number } {
    const kb = this.resolveKb(target)
    if (kb.roots.length === 0) return { files: 0, estCalls: 0 }
    const roots = opts.roots ?? kb.roots
    const scan = scanRoots(roots, kb.roots, this.config.excludes)
    const store = this.storeOf(kb)
    const dirty = diffAgainstIndex(scan.files, store.listSources())
    const resumeCount = store.listSources()
      .filter(s => ['pending', 'chunked', 'extracting', 'extracted', 'failed'].includes(s.state)
        && scan.files.some(f => f.path === s.path)).length
    const files = dirty.added.length + dirty.changed.length + resumeCount
    // 成本模型（0203 §5）：每 chunk 一次抽取 + 受影响社区一次摘要；文件级粗估 = 文件数 + 10% 摘要余量
    return { files, estCalls: files + Math.ceil(files * 0.1) }
  }
}

// ── 插件入口：注册进 seam（0201 §2 provider 行）────────────────────────────

export const name = 'dsh-kylin-vibe/provider'

/** 依赖 seam（dsh-ragflow 跨入口模式）；llm 鸭子型可选（降级矩阵）。 */
export const inject = ['graphrag'] as const

export function apply(ctx: Context, rawConfig: ProviderConfigInput = {}): void {
  const mounted = ctx as Context & { graphrag?: GraphRagServiceImpl }
  const service = mounted.graphrag
  if (service === undefined) {
    ctx.logger?.warn('dsh-kylin-vibe/provider: seam 未挂载（graphrag 行缺失或未先加载），provider 未注册')
    return
  }
  const config = clampConfig(rawConfig)
  const provider = new LocalGraphRagProvider(config, { ctx }, declaredKbsOf(rawConfig))
  ctx.effect(() => service.register(provider), 'dsh-kylin-vibe: provider registration')
}
