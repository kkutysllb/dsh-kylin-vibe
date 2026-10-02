/** 二进制文档文本抽取（docs/02-design/0203 §1.4 扩展，2026-10 用户裁定纳入）。
 *
 * 覆盖：DOCX/PPTX/XLSX（zip+xml 家族，fflate 解压 + 手写 XML 文本提取，
 * 零重量级依赖）；PDF（unpdf = pdf.js serverless 构建）；旧格式
 * .doc/.xls/.ppt 明确不支持（提示另存新格式）。图片走多模态视觉链路
 * （ingest 的 vision deps，不在此模块）。
 *
 * 产物统一为「带结构标记的纯文本」，交给既有 chunkText 分块——证据
 * path:lines 指向抽取文本行号（与 md 文档同语义）。
 */

import { readFileSync } from 'node:fs'

import { unzipSync, strFromU8 } from 'fflate'

export type DocExtractResult =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'unsupported'; readonly reason: string }
  | { readonly kind: 'failed'; readonly reason: string }

/** 可抽取的 Office/PDF 扩展名集合。 */
export const DOC_EXTRACT_EXTS: ReadonlySet<string> = new Set(['.docx', '.pptx', '.xlsx', '.pdf'])
/** 已知不支持的旧版二进制格式（明确报因而非笼统 skipped-binary）。 */
export const LEGACY_EXTS: ReadonlySet<string> = new Set(['.doc', '.ppt', '.xls'])
/** 视觉模型可读的图片扩展名（mime 映射见 imageMimeOf）。 */
export const IMAGE_EXTS: ReadonlySet<string> = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])

export function extOf(path: string): string {
  const i = path.lastIndexOf('.')
  return i < 0 ? '' : path.slice(i).toLowerCase()
}

export function imageMimeOf(ext: string): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | null {
  switch (ext) {
    case '.png': return 'image/png'
    case '.jpg': case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
    default: return null
  }
}

/** 体积护栏：防止超大文档/图片拖垮索引（50MB 文档 / 15MB 图片）。 */
export const MAX_DOC_BYTES = 50 * 1024 * 1024
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

// ── XML 文本提取（手写，OOXML 文本面足够）────────────────────────────────────

/** 解五个标准 XML 实体；OOXML 正文不含 CDATA 段（文本提取面不处理）。 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

/** 提取一类元素的全部文本（matchAll 逐段 decode，保守不回溯）。 */
function xmlTexts(xml: string, tagName: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(decodeXmlEntities(m[1]!))
  return out
}

// ── DOCX：word/document.xml 的 w:p 段落 × w:t 文本 ──────────────────────────

function extractDocx(xml: string): string {
  const paras: string[] = []
  const re = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const runs = xmlTexts(m[1]!, 'w:t').join('')
    if (runs.trim() !== '') paras.push(runs.trim())
  }
  return paras.join('\n')
}

// ── PPTX：ppt/slides/slideN.xml 的 a:p 段落（按页分组）──────────────────────

function extractPptx(files: Record<string, Uint8Array>): string {
  const slideNames = Object.keys(files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b))
  const pages: string[] = []
  for (const name of slideNames) {
    const xml = strFromU8(files[name]!)
    const paras: string[] = []
    const re = /<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(xml)) !== null) {
      const runs = xmlTexts(m[1]!, 'a:t').join('')
      if (runs.trim() !== '') paras.push(runs.trim())
    }
    if (paras.length > 0) pages.push(`[幻灯片 ${slideNo(name)}]\n${paras.join('\n')}`)
  }
  return pages.join('\n\n')
}

function slideNo(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
}

// ── XLSX：xl/sharedStrings.xml + xl/worksheets/sheetN.xml 行列重建 ──────────

function extractXlsx(files: Record<string, Uint8Array>): string {
  // 共享字符串表（可选部件）
  let shared: string[] = []
  const sstRaw = files['xl/sharedStrings.xml']
  if (sstRaw !== undefined) {
    const sst = strFromU8(sstRaw!)
    // 每个 <si> 的可见文本 = 其全部 <t> 拼接（富文本 si 含多段 r/t）
    const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g
    let m: RegExpExecArray | null
    while ((m = siRe.exec(sst)) !== null) shared.push(xmlTexts(m[1]!, 't').join(''))
  }

  const sheetNames = Object.keys(files)
    .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => sheetNo(a) - sheetNo(b))
  const pages: string[] = []
  const MAX_ROWS = 2000
  for (const name of sheetNames) {
    const xml = strFromU8(files[name]!)
    const rows: string[] = []
    const rowRe = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g
    let rm: RegExpExecArray | null
    while ((rm = rowRe.exec(xml)) !== null && rows.length < MAX_ROWS) {
      const cells: string[] = []
      const cRe = /<c(?:\s([^>]*?))?\s*\/?>(?:([\s\S]*?)<\/c>)?/g
      let cm: RegExpExecArray | null
      while ((cm = cRe.exec(rm[1]!)) !== null) {
        const attrs = cm[1] ?? ''
        const inner = cm[2] ?? ''
        const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? ''
        const value = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]
        let text: string
        if (type === 's' && value !== undefined) text = shared[Number(value)] ?? ''
        else if (type === 'inlineStr') text = xmlTexts(inner, 't').join('')
        else text = decodeXmlEntities(value ?? '')
        cells.push(text.trim())
      }
      if (cells.some(c => c !== '')) rows.push(cells.join(' | '))
    }
    if (rows.length > 0) {
      const truncated = rows.length >= MAX_ROWS ? `\n[超过 ${MAX_ROWS} 行已截断]` : ''
      pages.push(`[工作表 ${sheetNo(name)}]\n${rows.join('\n')}${truncated}`)
    }
  }
  return pages.join('\n\n')
}

function sheetNo(name: string): number {
  return Number(name.match(/sheet(\d+)\.xml$/)?.[1] ?? 0)
}

// ── PDF：unpdf（pdf.js serverless）按页提取 ─────────────────────────────────

async function extractPdf(absPath: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const buf = new Uint8Array(readFileSync(absPath))
  const pdf = await getDocumentProxy(buf)
  const { text } = await extractText(pdf, { mergePages: false })
  // 按页拼接：页标记给分块与证据以锚点
  const pages = Array.isArray(text) ? text : [text]
  return pages
    .map((p, i) => `[页 ${i + 1}]\n${p.trim()}`)
    .filter(p => p.replace(/\[页 \d+\]\n?/, '').trim() !== '')
    .join('\n\n')
}

// ── 主入口 ───────────────────────────────────────────────────────────────────

/** 按扩展名抽取二进制文档文本。仅对 DOC_EXTRACT_EXTS/LEGACY_EXTS/IMAGE_EXTS 调用。 */
export async function extractDocText(absPath: string, sizeBytes: number): Promise<DocExtractResult> {
  const ext = extOf(absPath)
  if (LEGACY_EXTS.has(ext)) {
    return { kind: 'unsupported', reason: 'legacy-binary（请另存为 .docx/.pptx/.xlsx 后重新索引）' }
  }
  if (sizeBytes > MAX_DOC_BYTES) {
    return { kind: 'failed', reason: `文件超过 ${Math.floor(MAX_DOC_BYTES / 1024 / 1024)}MB 上限` }
  }
  try {
    let text = ''
    if (ext === '.pdf') {
      text = await extractPdf(absPath)
    } else {
      const files = unzipSync(readFileSync(absPath))
      if (ext === '.docx') {
        const doc = files['word/document.xml']
        if (doc === undefined) return { kind: 'failed', reason: '损坏的 docx（缺 word/document.xml）' }
        text = extractDocx(strFromU8(doc!))
      } else if (ext === '.pptx') {
        text = extractPptx(files)
      } else if (ext === '.xlsx') {
        text = extractXlsx(files)
      }
    }
    if (text.trim() === '') {
      return { kind: 'failed', reason: 'empty-extract（可能是扫描件/无文本层，暂不支持 OCR）' }
    }
    return { kind: 'text', text }
  } catch (err) {
    return { kind: 'failed', reason: `parse-failed：${err instanceof Error ? err.message : String(err)}` }
  }
}
