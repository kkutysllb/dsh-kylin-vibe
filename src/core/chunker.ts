/** 分块器（docs/02-design/0203 §1.4 的最小实现）。
 *
 * 边界优先级：空行段 > 语义单元回落 > 硬截断；记录 (startLine, endLine,
 * startCol, endCol) 供证据引用（0202 chunk 表）。token 估算：CJK 逐字、
 * 其余按 3.5 字符/token。
 */

export interface ChunkOptions {
  readonly targetTokens?: number
  readonly maxTokens?: number
}

export interface ChunkResult {
  readonly path: string
  readonly ordinal: number
  readonly startLine: number
  readonly endLine: number
  readonly startCol: number
  readonly endCol: number
  readonly text: string
  readonly tokenEst: number
}

export function estimateTokens(text: string): number {
  let cjk = 0
  let rest = 0
  for (const ch of text) {
    if (/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/.test(ch)) cjk++
    else if (!/\s/.test(ch)) rest++
  }
  return Math.ceil(cjk + rest / 3.5)
}

/** 空行分块：返回行组，组内保留原始行号。 */
function blocksOf(lines: readonly string[]): { start: number; lines: string[] }[] {
  const blocks: { start: number; lines: string[] }[] = []
  let cur: { start: number; lines: string[] } | null = null
  const flush = (): void => {
    if (cur !== null && cur.lines.length > 0) blocks.push(cur)
    cur = null
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line.trim() === '') {
      flush()
      continue
    }
    // 标题行开启新块（标题与后文同块）
    if (cur !== null && /^#{1,6}\s/.test(line) && !/^#{1,6}\s/.test(cur.lines[0] ?? '')) {
      flush()
    }
    if (cur === null) cur = { start: i + 1, lines: [] }
    cur.lines.push(line)
  }
  flush()
  return blocks
}

export function chunkText(path: string, text: string, opts: ChunkOptions = {}): ChunkResult[] {
  const target = opts.targetTokens ?? 1000
  const max = opts.maxTokens ?? 1400
  const blocks = blocksOf(text.split('\n'))
  const results: ChunkResult[] = []

  const emit = (startLine: number, endLine: number, endCol: number, body: string): void => {
    if (body === '') return
    results.push({
      path,
      ordinal: results.length,
      startLine,
      endLine,
      startCol: 0,
      endCol,
      text: body,
      tokenEst: estimateTokens(body),
    })
  }

  // 贪心装填：块文本以空行分隔拼接，行号用块的真实起止行追踪
  let pending: string[] = []
  let pendingStart = 1
  let pendingEnd = 1
  let pendingEndCol = 0
  let pendingEst = 0
  const flush = (): void => {
    if (pending.length > 0) {
      emit(pendingStart, pendingEnd, pendingEndCol, pending.join('\n\n'))
      pending = []
      pendingEst = 0
    }
  }

  for (const block of blocks) {
    const blockText = block.lines.join('\n')
    const blockEst = estimateTokens(blockText)
    const blockEnd = block.start + block.lines.length - 1
    const blockEndCol = (block.lines[block.lines.length - 1] ?? '').length

    // 超长块：行级硬切
    if (blockEst > max) {
      flush()
      let acc: string[] = []
      let accStart = block.start
      let accEst = 0
      for (let li = 0; li < block.lines.length; li++) {
        const line = block.lines[li] as string
        const lineEst = estimateTokens(line)
        if (accEst + lineEst > max && acc.length > 0) {
          emit(accStart, accStart + acc.length - 1, (acc[acc.length - 1] ?? '').length, acc.join('\n'))
          acc = []
          accStart = block.start + li
          accEst = 0
        }
        acc.push(line)
        accEst += lineEst
      }
      if (acc.length > 0) {
        emit(accStart, accStart + acc.length - 1, (acc[acc.length - 1] ?? '').length, acc.join('\n'))
      }
      continue
    }

    if (pendingEst + blockEst > target && pending.length > 0) flush()
    if (pending.length === 0) pendingStart = block.start
    pending.push(blockText)
    pendingEnd = blockEnd
    pendingEndCol = blockEndCol
    pendingEst += blockEst
  }
  flush()
  return results
}
