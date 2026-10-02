/** Ingest 管线编排（docs/02-design/0203 §1，阶段 A→G）。
 *
 * 阶段：授权校验(A) → 扫描变更(B) → 分块(C) → 抽取(D) → 归并(E)
 *       → 社区(F, 变更超阈值才重算) → 摘要(G, 指纹漂移才重算)
 * checkpoint：source.state 状态机 + extraction_batch；AbortSignal 贯穿，
 * 中断后重跑从非终态断点续跑（0203 §1.1）。
 */

import { readFileSync } from 'node:fs'

import { chunkText, type ChunkOptions } from './chunker.ts'
import { DOC_EXTRACT_EXTS, extOf, extractDocText, IMAGE_EXTS, imageMimeOf, LEGACY_EXTS } from './extract-doc.ts'
import { computeMentions, extractChunk, extractImage, type LlmCompleter, type VisionCompleter } from './extractor.ts'
import { normName } from './types.ts'
import type { ExtractionDelta, SqliteGraphStore } from './graphstore.ts'
import { recomputeCommunities } from './lpa.ts'
import { diffAgainstIndex, scanRoots } from './scanner.ts'
import type { IndexReport } from './types.ts'

// ── 依赖与配置 ───────────────────────────────────────────────────────────────

/** 社区摘要器：生产走 LLM（宿主 provider 注入），评测/测试注入确定性实现。 */
export interface CommunitySummarizer {
  (input: {
    readonly members: readonly { readonly name: string; readonly type: string; readonly description: string | null }[]
    readonly topEdges: readonly { readonly s: string; readonly r: string; readonly o: string }[]
  }): Promise<string>
}

export interface IngestConfig {
  /** 授权索引根（realpath 前缀授权，ADR-9）。 */
  readonly authorizedRoots: readonly string[]
  /** 本次索引的子路径；缺省 = authorizedRoots 全部。 */
  readonly roots?: readonly string[]
  readonly excludes?: readonly string[]
  readonly chunk?: ChunkOptions
  readonly extract?: { readonly minConfidence?: number; readonly repairRetries?: number }
  readonly community?: { readonly recomputeThreshold?: number }
}

export interface IngestDeps {
  readonly llm: LlmCompleter
  readonly summarize: CommunitySummarizer
  /** 多模态视觉链路（可选）：缺席时图片文件标记 failed/vision-unavailable。 */
  readonly vision?: VisionCompleter
}

export type IngestPhase = 'scanning' | 'extracting' | 'communities' | 'summarizing'

export interface IngestProgress {
  readonly phase: IngestPhase
  readonly filesDone: number
  readonly filesTotal: number
  readonly currentFile?: string
  readonly quarantined: number
}

/** 二进制启发：NUL 字节视为二进制跳过（skipped 计数）。 */
function isBinary(buf: Buffer): boolean {
  return buf.includes(0)
}

/** token 估算（成本模型 0203 §5）：CJK 逐字、其余 3.5 字符/token。 */
function estTokens(s: string): number {
  let cjk = 0
  let rest = 0
  for (const ch of s) {
    if (/[\u3400-\u9fff\u3040-\u30ff]/.test(ch)) cjk++
    else if (!/\s/.test(ch)) rest++
  }
  return Math.ceil(cjk + rest / 3.5)
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

export async function runIngest(
  store: SqliteGraphStore,
  cfg: IngestConfig,
  deps: IngestDeps,
  signal?: AbortSignal,
  onProgress?: (p: IngestProgress) => void,
): Promise<IndexReport> {
  // 恢复扫描：残留 running 批次收敛 + 非终态 source 回 pending（0203 §1.1）
  store.recoverInterruptedBatches()
  for (const s of store.listSources()) {
    if (s.state !== 'merged' && s.state !== 'deleted') store.setSourceState(s.id, 'pending')
  }

  // ── 阶段 A+B：授权 + 扫描 + diff ──
  const roots = cfg.roots ?? cfg.authorizedRoots
  const scan = scanRoots(roots, cfg.authorizedRoots, cfg.excludes)
  const diff = diffAgainstIndex(scan.files, store.listSources())

  const before = store.counts()
  const batchId = store.startBatch(diff.added.length + diff.changed.length)
  const cost = { llmCalls: 0, tokensIn: 0, tokensOut: 0 }
  let quarantined = 0
  let skipped = 0
  let aborted = false

  // ── 阶段 B 尾：删除集级联（走 store.forget file 语义）──
  for (const path of diff.removed) store.forget({ kind: 'file', path })

  // ── 阶段 C+D+E：逐文件 分块→抽取→归并（文件间可中断）──
  // 断点续跑：非终态且仍存在的已入库文件并入脏集（0203 §1.1）
  const scannedPaths = new Set(scan.files.map(f => f.path))
  const dirtyPaths = new Set([...diff.added, ...diff.changed].map(f => f.path))
  const resume = store.listSources()
    .filter(s => ['pending', 'chunked', 'extracting', 'extracted', 'failed'].includes(s.state) && scannedPaths.has(s.path) && !dirtyPaths.has(s.path))
    .map(s => ({ path: s.path, absPath: s.absPath, contentHash: s.contentHash, sizeBytes: s.sizeBytes, mtimeMs: s.mtimeMs }))
  const dirty = [...diff.added, ...diff.changed, ...resume]
  onProgress?.({ phase: 'scanning', filesDone: 0, filesTotal: dirty.length, quarantined: 0 })
  let done = 0
  for (const f of dirty) {
    if (signal?.aborted) { aborted = true; break }
    onProgress?.({ phase: 'extracting', filesDone: done, filesTotal: dirty.length, currentFile: f.path, quarantined })

    const ext = extOf(f.path)
    const src = store.upsertSource({ path: f.path, absPath: f.absPath, contentHash: f.contentHash, sizeBytes: f.sizeBytes, mtimeMs: f.mtimeMs })

    // ── 扩展名路由（优先于 NUL 启发）：图片 / 可抽取文档 / 旧格式 ──
    if (IMAGE_EXTS.has(ext)) {
      const vision = deps.vision
      const mime = imageMimeOf(ext)
      if (vision === undefined || mime === null) {
        store.setSourceState(src.id, 'failed', 'vision-unavailable（当前宿主/模型不支持图片理解，可切换多模态模型后重新索引）')
        skipped++
        done++
        continue
      }
      const imageRes = await extractImage(
        vision,
        { data: new Uint8Array(readFileSync(f.absPath)), mime, name: f.path.split('/').pop() ?? f.path },
        f.path, cfg.extract, signal,
      )
      if (applyImageExtraction(store, src.id, f.path, imageRes)) {
        store.setSourceState(src.id, 'merged')
      } else {
        store.setSourceState(src.id, 'failed', `vision-${imageRes.errorCode}：${imageRes.detail}`)
      }
      cost.llmCalls += imageRes.llmCalls
      done++
      continue
    }
    if (DOC_EXTRACT_EXTS.has(ext) || LEGACY_EXTS.has(ext)) {
      const doc = await extractDocText(f.absPath, f.sizeBytes)
      if (doc.kind === 'unsupported') {
        store.setSourceState(src.id, 'failed', doc.reason)
        skipped++
        done++
        continue
      }
      if (doc.kind === 'failed') {
        store.setSourceState(src.id, 'failed', doc.reason)
        skipped++
        done++
        continue
      }
      // 抽取成功 → 以抽取文本走通用分块/抽取管线（落到下方 text 路径）
      await ingestText(store, cfg, deps, f, src, doc.text, signal, (phase) => { if (phase === 'abort') aborted = true }, (n) => { cost.llmCalls += n; return true }, (q) => { quarantined += q; if (q) fileFlags.failed = false })
      done++
      continue
    }

    const buf = readFileSync(f.absPath)
    if (isBinary(buf)) {
      skipped++
      store.setSourceState(src.id, 'failed', 'skipped-binary')
      done++
      continue
    }
    const text = buf.toString('utf8')

    // C：分块（replaceChunks 自带 FTS 同步）
    const chunks = chunkText(f.path, text, cfg.chunk)
    store.replaceChunks(src.id, chunks.map(c => ({
      ordinal: c.ordinal, startLine: c.startLine, endLine: c.endLine,
      startCol: c.startCol, endCol: c.endCol, text: c.text, tokenEst: c.tokenEst,
    })))
    store.setSourceState(src.id, 'extracting')

    // D：逐 chunk 抽取（每 chunk ≤2 次调用）
    let fileFailed = false
    let fileQuarantined = false
    for (const chunkRow of store.getChunks(src.id)) {
      if (signal?.aborted) break
      const res = await extractChunk(deps.llm, chunkRow.text, f.path, cfg.extract, signal)
      cost.llmCalls += res.llmCalls
      cost.tokensIn += estTokens(chunkRow.text)
      cost.tokensOut += estTokens(res.ok ? '' : res.rawOutput ?? '')
      if (!res.ok && signal?.aborted) { aborted = true; break } // 中断不进隔离区
      if (res.ok) {
        // E：归并（mention span 由实体名定位）
        const names = res.items.entities.map(e => e.n)
        const delta: ExtractionDelta = {
          sourceId: src.id, chunkId: chunkRow.id,
          entities: res.items.entities.map(e => ({ normName: normName(e.n), name: e.n, type: e.t, description: e.d, confidence: e.c })),
          relations: res.items.relations.map(r => ({ srcNorm: normName(r.s), dstNorm: normName(r.o), type: r.r, description: r.d, confidence: r.c })),
          mentions: computeMentions(chunkRow.text, names),
        }
        store.applyExtraction(delta)
      } else if (res.errorCode === 'EMPTY') {
        // 合法无内容：跳过不落隔离区
      } else {
        quarantined++
        fileQuarantined = fileQuarantined || res.errorCode === 'PARSE_FAILED'
        fileFailed = fileFailed || res.errorCode === 'LLM_ERROR'
        store.quarantinePut(chunkRow.id, chunkRow.text, res.rawOutput, res.errorCode, res.detail)
      }
    }

    if (signal?.aborted) { aborted = true; store.setSourceState(src.id, 'pending'); break }
    if (fileFailed) store.setSourceState(src.id, 'failed', 'LLM_ERROR')
    else if (fileQuarantined) store.setSourceState(src.id, 'quarantined')
    else store.setSourceState(src.id, 'merged')
    done++
  }

  const afterFiles = store.counts()

  // ── 阶段 F：社区重算（边变更超阈值；abort 时不做）──
  let communitiesRebuilt = 0
  let summariesRecomputed = 0
  const threshold = cfg.community?.recomputeThreshold ?? 0.05
  const edgeDelta = afterFiles.relations - before.relations + diff.removed.length // 保守估计含删除影响
  if (!aborted && afterFiles.relations > 0 && edgeDelta / Math.max(afterFiles.relations, 1) >= threshold) {
    onProgress?.({ phase: 'communities', filesDone: dirty.length, filesTotal: dirty.length, quarantined })
    const res = recomputeCommunities(store)
    communitiesRebuilt = res.communities

    // ── 阶段 G：指纹漂移的社区重算摘要 ──
    onProgress?.({ phase: 'summarizing', filesDone: dirty.length, filesTotal: dirty.length, quarantined })
    for (const c of store.listCommunities()) {
      const summary = store.allSummaries().find(s => s.communityId === c.id)
      if (summary && summary.fingerprintAt === c.fingerprint) continue
      const members = store.entitiesByCommunity(c.id, 8)
      const topEdges = store.relationsAmong(new Set(members.map(m => m.id)), 8)
        .map(e => ({ s: e.srcName, r: e.relation.type, o: e.dstName }))
      const text = await deps.summarize({ members: members.map(m => ({ name: m.name, type: m.type, description: m.description })), topEdges })
      cost.tokensIn += estTokens(JSON.stringify(members))
      cost.tokensOut += estTokens(text)
      cost.llmCalls += 1
      store.putSummary({ communityId: c.id, summary: text, entitiesTop: members.slice(0, 5).map(m => m.name), fingerprintAt: c.fingerprint })
      summariesRecomputed++
    }
  }

  store.finishBatch(batchId, aborted ? 'aborted' : 'done', cost)
  const final = store.counts()
  return {
    files: { new: diff.added.length, changed: diff.changed.length, deleted: diff.removed.length, skipped },
    graphDelta: {
      entitiesAdded: final.entities - before.entities,
      relationsAdded: final.relations - before.relations,
      communitiesRebuilt,
      summariesRecomputed,
    },
    cost,
    quarantined,
    aborted,
  }
}
