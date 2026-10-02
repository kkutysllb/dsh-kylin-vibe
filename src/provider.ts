/** 本地引擎 Provider v2（docs/02-design/0207）：多知识库 + 宿主 llm 惰性解析。
 *
 * 职责边界：KB 注册表（kbs.json）、按库隔离的 SQLite store、配置声明合并、
 * 降级矩阵（无 llm：词法/遍历可用，抽取/摘要/索引返回 NO_PROVIDER）。
 * 不触碰工具面（tool.ts）。
 */

import { mkdirSync, existsSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { llmCompleterOf, llmServiceOf, resolveDataDir, visionCompleterOf } from './adapter.ts'
import type { ChunkOptions } from './core/chunker.ts'
import { extractChunk, type LlmCompleter, type VisionCompleter } from './core/extractor.ts'
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
import { GraphRagServiceImpl, type EntityCard, type GraphRagProvider, type HealthReport, type IndexOptions, type KbRef, type QueryInput, type ReviewSample, type TraverseInput } from './index.ts'

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
  /** 审查状态（按 KB）：排除的关系 id 集 + 抽样统计。 */
  private readonly reviewExclude = new Map<string, Set<number>>()
  private readonly reviewStats = new Map<string, { sampled: number; correct: number; corrected: number }>()

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

  /** 视觉链路（可选）：附件服务/模型不支持时为 null（ingest 据此降级）。 */
  private cachedVision: VisionCompleter | null | undefined
  private visionOf(): VisionCompleter | null {
    if (this.cachedVision !== undefined) return this.cachedVision
    const ctx = this.deps.ctx
    const model = this.config.model
    if (ctx === null || model === null) {
      this.cachedVision = null
      return null
    }
    this.cachedVision = visionCompleterOf(ctx, model, this.config.retry)
    return this.cachedVision
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
    const notesDir = this.notesDirOf(kb)
    if (kb.roots.length === 0 && !existsSync(notesDir)) {
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
      // notes 目录存在才并入（为空/未用面板补充的库不产生空目录）
      authorizedRoots: [...kb.roots, ...(existsSync(notesDir) ? [notesDir] : [])],
      roots: opts.roots,
      excludes: this.config.excludes,
      chunk: this.config.chunk,
      extract: this.config.extract,
      community: this.config.community,
    }
    void runIngest(store, cfg, { llm, summarize: summarizerOf(llm), vision: this.visionOf() ?? undefined }, controller.signal, p => {
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
    const notesDir = this.notesDirOf(kb)
    if (kb.roots.length === 0 && !existsSync(notesDir)) {
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
      // notes 目录存在才并入（为空/未用面板补充的库不产生空目录）
      authorizedRoots: [...kb.roots, ...(existsSync(notesDir) ? [notesDir] : [])],
      roots: opts.roots,
      excludes: this.config.excludes,
      chunk: this.config.chunk,
      extract: this.config.extract,
      community: this.config.community,
    }
    const report = await runIngest(store, cfg, { llm, summarize: summarizerOf(llm), vision: this.visionOf() ?? undefined }, signal)
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

  // ── 浏览与审查面（0207 §3.3/§3.4）────────────────────────────────────

  /** 浏览页：实体搜索（含邻居与原文引用）。 */
  browseEntities(target: KbRef, query: string, limit: number): readonly EntityCard[] {
    const kb = this.resolveKb(target)
    const store = this.storeOf(kb)
    const { extractTerms } = require('./core/lexical.ts') as never as typeof import('./core/lexical.ts')
    const terms = extractTerms(query)
    const raws = terms.length > 0
      ? store.searchEntityCards(terms, limit)
      : (store.allEntities().slice(0, limit) as unknown as Array<{ id: number | bigint; norm_name: string; name: string; type: string; description: string | null; community_id: number | bigint | null; degree: number | bigint }>)
    return raws.map(r => {
      const e = this.mapEntityPublic(r)
      const neighbors = store.neighbors(e.id, 'both').map(edge => {
        const rel = edge.relation
        const evidence = store.relationEvidence(rel.id).slice(0, 1).map(ev => ({ path: ev.path, lines: `${ev.startLine}-${ev.endLine}` }))
        return {
          dir: rel.srcId === e.id ? ('out' as const) : ('in' as const),
          type: rel.type,
          weight: rel.weight,
          other: rel.srcId === e.id ? edge.dstName : edge.srcName,
          evidence,
        }
      })
      return { id: e.id, name: e.name, type: e.type, description: e.description, degree: e.degree, communityId: e.communityId, neighbors }
    })
  }

  /** 审查页：分层抽样（低置信优先，排除已判）。 */
  sampleForReview(target: KbRef, limit: number): readonly ReviewSample[] {
    const kb = this.resolveKb(target)
    const store = this.storeOf(kb)
    const excluded = [...(this.reviewExclude.get(kb.id) ?? [])]
    return store.sampleRelations(limit, excluded).map(x => ({
      id: x.relation.id,
      s: x.srcName,
      r: x.relation.type,
      o: x.dstName,
      confidence: x.relation.confidence,
      evidence: store.relationEvidence(x.relation.id).map(ev => ({ path: ev.path, startLine: ev.startLine, endLine: ev.endLine, text: ev.text })),
    }))
  }

  /** 面板补充知识的落地目录（provider 托管，索引时并入授权根）。 */
  private notesDirOf(kb: { readonly id: string }): string {
    return join(this.config.dataDir, 'kbs', kb.id, 'notes')
  }

  /** 补充新知识：用户粘贴文本落为笔记文件并后台增量索引。 */
  addTextKnowledge(target: KbRef, title: string, text: string): { readonly file: string; readonly started: boolean } {
    const kb = this.resolveKb(target)
    const cleanTitle = title.trim() !== '' ? title.trim() : '补充知识'
    const slug = cleanTitle.replaceAll(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40)
    const dir = this.notesDirOf(kb)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${Date.now()}-${slug}.md`)
    writeFileSync(file, `# ${cleanTitle}\n\n${text}\n`, 'utf8')
    let started = false
    try {
      started = this.indexBackground({ id: kb.id }, {}).started
    } catch { /* 模型不可用等：文件已落，下次索引自动收编 */ }
    return { file, started }
  }

  /** 已入库来源清单（含陈旧/失败，供面板管理）。isNote 用 realpath 比较
   * （scanner 存 realpath，而 notesDir 未经解析——macOS /var 符号差异）。 */
  listKnowledge(target: KbRef): readonly { readonly path: string; readonly absPath: string; readonly state: string; readonly isNote: boolean }[] {
    const kb = this.resolveKb(target)
    const raw = this.notesDirOf(kb)
    const notesDir = existsSync(raw) ? realpathSync(raw) : raw
    return this.storeOf(kb).listSources().map(s => ({
      path: s.path,
      absPath: s.absPath,
      state: s.state,
      isNote: s.absPath.startsWith(notesDir),
    }))
  }

  /** 删除旧知识：整文件图谱级联清除；笔记文件同时删除物理文件。 */
  async forgetKnowledge(target: KbRef, path: string): Promise<{ readonly deleted: { chunks: number; relations: number; entities: number } }> {
    const kb = this.resolveKb(target)
    const raw = this.notesDirOf(kb)
    const notesDir = existsSync(raw) ? realpathSync(raw) : raw
    const src = this.storeOf(kb).getSource(path)
    if (src !== null && src.absPath.startsWith(notesDir) && existsSync(src.absPath)) {
      rmSync(src.absPath)
    }
    return this.forget({ id: kb.id }, { kind: 'file', path }).then(report => ({ deleted: report.deleted }))
  }

  /** 选区更正建议：对用户滑选的原文片段跑同款 SPO 抽取，返回候选三元组
   * 供更正编辑器预填。模型不可用/解析失败返回空三元组（前端回落手动填写）。 */
  async correctFromSelection(target: KbRef | undefined, text: string): Promise<{ readonly triples: ReadonlyArray<{ s: string; r: string; o: string }> }> {
    const clipped = text.length > 2000 ? text.slice(0, 2000) : text
    if (clipped.trim() === '') return { triples: [] }
    const llm = this.completer()
    if (llm === null) throw new GraphRagError('NO_PROVIDER', '模型 provider 不可用，请手动填写更正')
    const result = await extractChunk(llm, clipped, '面板更正选区', { minConfidence: 0.6, repairRetries: 0 })
    if (!result.ok) return { triples: [] }
    return {
      triples: result.items.relations
        .filter(rel => rel.s.trim() !== '' && rel.o.trim() !== '')
        .slice(0, 5)
        .map(rel => ({ s: rel.s.trim(), r: rel.r.trim(), o: rel.o.trim() })),
    }
  }

  /** 审查判定：correct/wrong 计入抽样统计；wrong 进排除清单（置信度置 -1）。
   * correction 非空且有实际变化时改写关系端点/类型（人工确认置信度置 1、
   * 清除排除态），计入 corrected 统计，且不再排除。 */
  reviewRelation(
    target: KbRef,
    relationId: number,
    verdict: 'correct' | 'wrong' | 'unsure',
    correction?: { readonly s?: string; readonly r?: string; readonly o?: string },
  ): { readonly excluded: boolean; readonly corrected: boolean } {
    const kb = this.resolveKb(target)
    const stats = this.reviewStats.get(kb.id) ?? { sampled: 0, correct: 0, corrected: 0 }
    let corrected = false
    if (correction !== undefined) {
      const next: { srcName?: string; type?: string; dstName?: string } = {}
      if (correction.s !== undefined && correction.s.trim() !== '') next.srcName = correction.s.trim()
      if (correction.r !== undefined && correction.r.trim() !== '') next.type = correction.r.trim()
      if (correction.o !== undefined && correction.o.trim() !== '') next.dstName = correction.o.trim()
      if (Object.keys(next).length > 0) {
        const res = this.storeOf(kb).updateRelationEnds(relationId, next)
        corrected = res.changed
        if (corrected) {
          this.reviewExclude.get(kb.id)?.delete(relationId)
          stats.sampled += 1
          stats.corrected += 1
          this.reviewStats.set(kb.id, stats)
          return { excluded: false, corrected: true }
        }
      }
    }
    if (verdict === 'unsure') return { excluded: false, corrected: false }
    stats.sampled += 1
    if (verdict === 'correct') stats.correct += 1
    this.reviewStats.set(kb.id, stats)
    if (verdict !== 'wrong') return { excluded: false, corrected: false }
    const store = this.storeOf(kb)
    const set = this.reviewExclude.get(kb.id) ?? new Set<number>()
    set.add(relationId)
    this.reviewExclude.set(kb.id, set)
    store.excludeRelation(relationId)
    return { excluded: true, corrected: false }
  }

  /** 体检报告（0207 §3.4 结论卡）。 */
  healthReport(target: KbRef): HealthReport {
    const kb = this.resolveKb(target)
    const store = this.storeOf(kb)
    const sources = store.listSources()
    const indexed = sources.filter(s => s.state === 'merged').length
    const stale = sources.filter(s => s.state !== 'merged' && s.state !== 'deleted').length
    const quarantined = sources.filter(s => s.state === 'quarantined').length
    const review = this.reviewStats.get(kb.id) ?? { sampled: 0, correct: 0, corrected: 0 }
    const excluded = this.reviewExclude.get(kb.id)
    const excludedCount = excluded !== undefined && excluded.size > 0 ? excluded.size : store.excludedRelationCount()
    const scannedTotal = indexed + stale
    return {
      kbName: kb.name,
      files: { indexed, stale, quarantined },
      coverage: scannedTotal === 0 ? null : indexed / scannedTotal,
      quarantineRate: (indexed + quarantined) === 0 ? null : quarantined / (indexed + quarantined),
      sampled: review.sampled,
      correct: review.correct,
      corrected: review.corrected,
      samplePrecision: review.sampled === 0 ? null : review.correct / review.sampled,
      excludedRelations: excludedCount,
      lastIndexAt: kb.lastIndexedAt,
    }
  }

  private mapEntityPublic(r: { id: number | bigint; norm_name: string; name: string; type: string; description: string | null; community_id: number | bigint | null; degree: number | bigint }) {
    return {
      id: Number(r.id),
      name: r.name,
      type: r.type,
      description: r.description,
      communityId: r.community_id === null ? null : Number(r.community_id),
      degree: Number(r.degree),
    }
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
