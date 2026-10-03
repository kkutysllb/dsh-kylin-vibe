/** LLM 实体/关系抽取器（docs/02-design/0203 §1.5）。
 *
 * 成本纪律：每 chunk 至多 2 次调用（1 次抽取 + 1 次修复重试）；
 * 两次都解析失败 → 隔离区（PARSE_FAILED），绝不污染主图。
 * LlmCompleter 是宿主无关的抽象：宿主 provider 用 ctx.llm 实现，
 * 测试/评测用脚本化 fixture 实现。
 */

import { z } from 'zod'

import { ENTITY_TYPES, RELATION_TYPES, GraphRagError, normName, type EntityType, type ExtractedItem, type RelationType } from './types.ts'

// ── LLM 抽象 ─────────────────────────────────────────────────────────────────

export interface LlmCompleter {
  complete(system: string, user: string, signal?: AbortSignal): Promise<string>
}

// ── Prompt 契约（0203 §1.5）─────────────────────────────────────────────────

export const EXTRACTION_SYSTEM = `你是代码库知识抽取器。从给定文本块中抽取实体与关系。
实体类型（封闭集）：${ENTITY_TYPES.join(', ')}
规则：
- 只抽取文本中有明确依据的项；不确定就不抽（宁缺勿滥）
- 每项给 confidence，取值 0.6 / 0.8 / 1.0
- 关系类型（封闭集）：${RELATION_TYPES.join(', ')}
输出：仅输出 JSON，无其他文本。模式：
{"entities":[{"n":"名称","t":"类型","d":"≤40字描述","c":0.8}],"relations":[{"s":"源名","r":"类型","o":"目标名","d":"≤40字描述","c":0.8}]}`

export function buildExtractionUser(chunkText: string, sourcePath: string): string {
  return `来源：${sourcePath}\n\n${chunkText}`
}

// ── 输出解析（纯函数）───────────────────────────────────────────────────────

/** 剥离 markdown 围栏与前后杂文（对话式模型常见）。 */
export function stripFences(raw: string): string {
  let s = raw.trim()
  // ```json ... ``` 或 ``` ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence?.[1]) s = fence[1].trim()
  // 前置杂文：截取首个 { 到最后一个 }
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  return s.trim()
}

const RawEntity = z.object({
  n: z.string().min(1),
  t: z.string(),
  d: z.string().nullish(),
  c: z.number(),
})
const RawRelation = z.object({
  s: z.string().min(1),
  r: z.string(),
  o: z.string().min(1),
  d: z.string().nullish(),
  c: z.number(),
})
const RawOutput = z.object({
  entities: z.array(RawEntity).default([]),
  relations: z.array(RawRelation).default([]),
})

export interface ParsedExtraction {
  items: ExtractedItem
  /** 因 schema 不合规被丢弃的条目数。 */
  dropped: number
}

/** 解析 + 逐条校验：封闭类型集外/置信度越界的条目丢弃并计数，
 * 合法条目按 minConfidence 过滤（0203 §1.5 步骤 3/4）。 */
export function validateExtraction(rawObj: unknown, minConfidence: number): ParsedExtraction {
  const parsed = RawOutput.safeParse(rawObj)
  if (!parsed.success) return { items: { entities: [], relations: [] }, dropped: 0 }
  let dropped = 0
  const entities = []
  for (const e of parsed.data.entities) {
    if (!isEntityType(e.t) || !inConfidence(e.c) || e.c < minConfidence) { dropped++; continue }
    entities.push({ n: e.n, t: e.t as EntityType, d: e.d ?? null, c: e.c })
  }
  const relations = []
  for (const r of parsed.data.relations) {
    if (!isRelationType(r.r) || !inConfidence(r.c) || r.c < minConfidence) { dropped++; continue }
    relations.push({ s: r.s, r: r.r as RelationType, o: r.o, d: r.d ?? null, c: r.c })
  }
  return { items: { entities, relations }, dropped }
}

function isEntityType(t: string): t is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(t)
}
function isRelationType(r: string): r is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(r)
}
function inConfidence(c: number): boolean {
  return Number.isFinite(c) && c > 0 && c <= 1
}

// ── mention span 计算 ────────────────────────────────────────────────────────

/** 实体名在 chunk 文本中的全部出现位置（latin 大小写不敏感）。
 * 同一实体多别名时由调用方按别名集展开。 */
export function computeMentions(text: string, names: readonly string[]): { normName: string; spanStart: number; spanEnd: number }[] {
  const lower = text.toLowerCase()
  const out: { normName: string; spanStart: number; spanEnd: number }[] = []
  for (const name of names) {
    if (name.length === 0) continue
    const needle = name.toLowerCase()
    let from = 0
    for (;;) {
      const at = lower.indexOf(needle, from)
      if (at < 0) break
      out.push({ normName: normName(name), spanStart: at, spanEnd: at + name.length })
      from = at + name.length
    }
  }
  return out.sort((a, b) => a.spanStart - b.spanStart)
}

// ── 图片视觉抽取（多模态，2026-10 用户裁定纳入）─────────────────────────────

export const VISION_SYSTEM = `你是图片知识抽取器。观察图片内容（架构图/流程图/组织结构/表格截图/照片等），抽取实体与关系。
实体类型（封闭集）：${ENTITY_TYPES.join(', ')}
规则：
- 只抽取图片中有明确依据的项；看不清/不确定就不抽（宁缺勿滥）
- 实体名使用图片中出现的原文；表格截图按行列抽取实体并建立关系
- 每项给 confidence，取值 0.6 / 0.8 / 1.0
- 关系类型（封闭集）：${RELATION_TYPES.join(', ')}
输出：仅输出 JSON，无其他文本。模式：
{"entities":[{"n":"名称","t":"类型","d":"≤40字描述","c":0.8}],"relations":[{"s":"源名","r":"类型","o":"目标名","d":"≤40字描述","c":0.8}]}`

/** 宿主无关的视觉补全抽象：save 上传图片得到不透明引用，complete 携图补全。
 * 宿主 provider 用 attachments.saveImages + llm stream image 块实现；
 * 测试注入 fixture。ref 不透明——ingest 层不感知附件服务契约。 */
export interface VisionCompleter {
  save(input: { readonly data: Uint8Array; readonly mime: string; readonly name: string }): Promise<unknown>
  complete(system: string, user: string, ref: unknown, signal?: AbortSignal): Promise<string>
}

/** 图片抽取：同款成本纪律（≤1+retries 次调用，解析失败重试携原图）。 */
export async function extractImage(
  vision: VisionCompleter,
  image: { readonly data: Uint8Array; readonly mime: string; readonly name: string },
  sourcePath: string,
  opts: ExtractChunkOptions = {},
  signal?: AbortSignal,
): Promise<ExtractChunkResult> {
  const minConfidence = opts.minConfidence ?? 0.6
  const retries = opts.repairRetries ?? 1
  let ref: unknown
  try {
    ref = await vision.save(image)
  } catch (err) {
    return { ok: false, errorCode: 'LLM_ERROR', detail: `图片上传失败：${err instanceof Error ? err.message : String(err)}`, rawOutput: null, llmCalls: 0 }
  }

  let raw: string
  try {
    raw = await vision.complete(VISION_SYSTEM, `来源：${sourcePath}\n\n请观察这张图片并抽取实体与关系。`, ref, signal)
  } catch (err) {
    return { ok: false, errorCode: 'LLM_ERROR', detail: err instanceof Error ? err.message : String(err), rawOutput: null, llmCalls: 1 }
  }
  let llmCalls = 1

  let lastError = ''
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) return { ok: false, errorCode: 'LLM_ERROR', detail: 'aborted', rawOutput: raw, llmCalls }
    let obj: unknown
    try {
      obj = JSON.parse(stripFences(raw))
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < retries) {
        try {
          raw = await vision.complete(
            '你的上一个输出不是合法 JSON。仅输出修正后的 JSON，无其他文本。',
            `上次输出：\n${raw.slice(0, 4000)}\n\n错误：${lastError}\n\n请输出修正后的完整 JSON。`,
            ref, signal,
          )
          llmCalls++
          continue
        } catch (err2) {
          return { ok: false, errorCode: 'LLM_ERROR', detail: err2 instanceof Error ? err2.message : String(err2), rawOutput: raw, llmCalls }
        }
      }
      return { ok: false, errorCode: 'PARSE_FAILED', detail: lastError, rawOutput: raw, llmCalls }
    }
    const { items, dropped } = validateExtraction(obj, minConfidence)
    if (items.entities.length === 0 && items.relations.length === 0) {
      if (dropped > 0) return { ok: false, errorCode: 'PARSE_FAILED', detail: `${dropped} 条目未通过校验被全部丢弃`, rawOutput: raw, llmCalls }
      return { ok: false, errorCode: 'EMPTY', detail: '图片中无可抽取的实体或关系', rawOutput: raw, llmCalls }
    }
    return { ok: true, items, dropped, llmCalls }
  }
  return { ok: false, errorCode: 'PARSE_FAILED', detail: lastError, rawOutput: raw, llmCalls }
}

// ── 单 chunk 抽取编排 ───────────────────────────────────────────────────────

export interface ExtractChunkOptions {
  readonly minConfidence?: number
  readonly repairRetries?: number
}

export type ExtractChunkResult =
  | { readonly ok: true; readonly items: ExtractedItem; readonly dropped: number; readonly llmCalls: number }
  | { readonly ok: false; readonly errorCode: 'PARSE_FAILED' | 'LLM_ERROR' | 'EMPTY' | 'CONTEXT_WINDOW'; readonly detail: string; readonly rawOutput: string | null; readonly llmCalls: number }

/** completer 抛错 → 三态失败码（CONTEXT_WINDOW 单列，ingest 据此对半细分）。 */
function toChunkError(err: unknown): { readonly errorCode: 'LLM_ERROR' | 'CONTEXT_WINDOW'; readonly detail: string } {
  if (err instanceof GraphRagError && err.code === 'CONTEXT_WINDOW') {
    return { errorCode: 'CONTEXT_WINDOW', detail: err.message }
  }
  return { errorCode: 'LLM_ERROR', detail: err instanceof Error ? err.message : String(err) }
}

export async function extractChunk(
  llm: LlmCompleter,
  chunkText: string,
  sourcePath: string,
  opts: ExtractChunkOptions = {},
  signal?: AbortSignal,
): Promise<ExtractChunkResult> {
  const minConfidence = opts.minConfidence ?? 0.6
  const retries = opts.repairRetries ?? 1
  const system = EXTRACTION_SYSTEM
  const user = buildExtractionUser(chunkText, sourcePath)

  let raw: string
  try {
    raw = await llm.complete(system, user, signal)
  } catch (err) {
    const mapped = toChunkError(err)
    return { ok: false, ...mapped, rawOutput: null, llmCalls: 0 }
  }
  let llmCalls = 1

  let lastError = ''
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) return { ok: false, errorCode: 'LLM_ERROR', detail: 'aborted', rawOutput: raw, llmCalls }
    const stripped = stripFences(raw)
    let obj: unknown
    try {
      obj = JSON.parse(stripped)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < retries) {
        // 修复重试：把报错喂回去，要求仅输出修正 JSON（0203 §1.5 步骤 2）
        try {
          raw = await llm.complete(
            '你的上一个输出不是合法 JSON。仅输出修正后的 JSON，无其他文本。',
            `上次输出：\n${raw.slice(0, 4000)}\n\n错误：${lastError}\n\n请输出修正后的完整 JSON。`,
            signal,
          )
          llmCalls++
          continue
        } catch (err2) {
          return { ok: false, errorCode: 'LLM_ERROR', detail: err2 instanceof Error ? err2.message : String(err2), rawOutput: raw, llmCalls }
        }
      }
      return { ok: false, errorCode: 'PARSE_FAILED', detail: lastError, rawOutput: raw, llmCalls }
    }
    const { items, dropped } = validateExtraction(obj, minConfidence)
    if (items.entities.length === 0 && items.relations.length === 0) {
      // 合法 JSON 但全空：可能是"确实没有可抽项"（合法）或格式漂移（可疑）。
      // dropped > 0 说明有条目被丢弃 → SCHEMA_INVALID 语义并入 PARSE_FAILED 记录。
      if (dropped > 0) return { ok: false, errorCode: 'PARSE_FAILED', detail: `${dropped} 条目未通过校验被全部丢弃`, rawOutput: raw, llmCalls }
      return { ok: false, errorCode: 'EMPTY', detail: '无有效实体或关系', rawOutput: raw, llmCalls }
    }
    return { ok: true, items, dropped, llmCalls }
  }
  return { ok: false, errorCode: 'PARSE_FAILED', detail: lastError, rawOutput: raw, llmCalls }
}
