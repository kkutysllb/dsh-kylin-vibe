/** 词法召回（docs/02-design/0202 §3 FTS5 / 0203 §2.1）。
 *
 * node:sqlite + FTS5 trigram 分词器：对 CJK 与代码标识符都友好，
 * 无外置分词依赖。BM25 排序（FTS5 默认，越小越优）。
 */

import { DatabaseSync } from 'node:sqlite'

export interface LexRow {
  readonly id: number
  readonly path: string
  readonly text: string
}

export interface LexHit {
  readonly id: number
  readonly path: string
  readonly score: number
}

/** 查询词抽取：CJK 段取 3-gram（trigram 索引的最小匹配单位），
 * 拉丁/数字 token 取小写（len ≥ 3）。 */
export function extractTerms(query: string): string[] {
  const terms = new Set<string>()
  for (const raw of query.split(/[\s\p{P}\p{S}]+/u)) {
    if (raw === '') continue
    if (/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/.test(raw)) {
      if (raw.length >= 3) {
        for (let i = 0; i + 2 < raw.length; i++) terms.add(raw.slice(i, i + 3))
        // 首尾 3-gram 覆盖不足时补全段
        if (raw.length === 3) terms.add(raw)
      }
    } else {
      const low = raw.toLowerCase()
      if (low.length >= 3) terms.add(low)
    }
  }
  return [...terms]
}

function escapeFts(term: string): string {
  return `"${term.replaceAll('"', '""')}"`
}

export class LexicalIndex {
  private readonly db: DatabaseSync

  constructor(rows: readonly LexRow[]) {
    this.db = new DatabaseSync(':memory:')
    this.db.exec(`CREATE VIRTUAL TABLE chunk_fts USING fts5(text, path UNINDEXED, tokenize='trigram')`)
    const insert = this.db.prepare('INSERT INTO chunk_fts (rowid, text, path) VALUES (?, ?, ?)')
    for (const r of rows) insert.run(BigInt(r.id), r.text, r.path)
  }

  /** BM25 Top-k。terms 为空时返回空。 */
  search(terms: readonly string[], k: number): LexHit[] {
    if (terms.length === 0) return []
    const match = terms.map(escapeFts).join(' OR ')
    const stmt = this.db.prepare(
      'SELECT rowid AS id, path, bm25(chunk_fts) AS score FROM chunk_fts WHERE chunk_fts MATCH ? ORDER BY score LIMIT ?',
    )
    const out = stmt.all(match, BigInt(k)) as unknown as { id: bigint | number; path: string; score: number }[]
    return out.map(h => ({
      id: Number(h.id),
      path: h.path,
      score: h.score,
    }))
  }

  close(): void {
    this.db.close()
  }
}
