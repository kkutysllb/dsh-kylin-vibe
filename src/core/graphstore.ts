/** GraphStore：node:sqlite 实现（docs/02-design/0202 §3/§4）。
 *
 * 与设计文档的偏差（记录于 0301）：
 * - 接口为同步而非 Promise——node:sqlite 本身同步，核心库保持简单；
 *   宿主 provider 层负责调度（分段 setImmediate / worker）。
 * - `diffDirty` 拆到 scanner（ingest 管线阶段 B），store 只管数据库。
 * - 新增 `relation_evidence` 表：relation 与 chunk 的证据关联，支撑
 *   forget(file) 的 weight 递减与"零证据关系清除"语义。
 * - 社区重算（recomputeCommunities）依赖 lpa.ts，随 M1-W4 落地。
 */

import { DatabaseSync } from 'node:sqlite'

import type {
  ChunkRef, Community, CommunitySummary, Entity, EntityType, ForgetReport,
  ForgetTarget, QuarantineEntry, QuarantineErrorCode, Relation, RelationType, SourceRow, SourceState,
} from './types.ts'
import { normName } from './types.ts'

// ── 输入形状 ─────────────────────────────────────────────────────────────────

export interface SourceInput {
  readonly path: string
  readonly absPath: string
  readonly contentHash: string
  readonly sizeBytes: number
  readonly mtimeMs: number
}

export interface ChunkInput {
  readonly ordinal: number
  readonly startLine: number
  readonly endLine: number
  readonly startCol: number
  readonly endCol: number
  readonly text: string
  readonly tokenEst: number
}

export interface EntityUpsert {
  readonly normName: string
  readonly name: string
  readonly type: EntityType
  readonly description: string | null
  readonly confidence: number
}

export interface RelationUpsert {
  readonly srcNorm: string
  readonly dstNorm: string
  readonly type: RelationType
  readonly description: string | null
  readonly confidence: number
}

/** 单 chunk 抽取结果落库（0203 §1.5 解析产物 + mention span）。 */
export interface ExtractionDelta {
  readonly sourceId: number
  readonly chunkId: number
  readonly entities: readonly EntityUpsert[]
  readonly relations: readonly RelationUpsert[]
  readonly mentions: readonly { readonly normName: string; readonly spanStart: number; readonly spanEnd: number }[]
}

export interface EntityHit {
  readonly entity: Entity
  readonly score: number
}

export interface EdgeRow {
  readonly relation: Relation
  readonly srcName: string
  readonly dstName: string
}

export interface SubgraphRows {
  readonly nodes: Entity[]
  readonly edges: EdgeRow[]
  readonly truncated: boolean
}

export interface CommunityDelta {
  readonly communities: readonly Community[]
  readonly changed: number
}

export interface CommunitySummaryInput {
  readonly communityId: number
  readonly summary: string
  readonly entitiesTop: readonly string[]
  readonly fingerprintAt: string
}

// ── DDL（schema_version 1）──────────────────────────────────────────────────

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS source (
  id           INTEGER PRIMARY KEY,
  path         TEXT NOT NULL UNIQUE,
  abs_path     TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  mtime_ms     INTEGER NOT NULL,
  state        TEXT NOT NULL DEFAULT 'pending',
  error        TEXT
);

CREATE TABLE IF NOT EXISTS chunk (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  ordinal    INTEGER NOT NULL,
  start_line INTEGER NOT NULL,
  end_line   INTEGER NOT NULL,
  start_col  INTEGER NOT NULL,
  end_col    INTEGER NOT NULL,
  text       TEXT NOT NULL,
  token_est  INTEGER NOT NULL,
  UNIQUE(source_id, ordinal)
);

CREATE TABLE IF NOT EXISTS entity (
  id           INTEGER PRIMARY KEY,
  norm_name    TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  description  TEXT,
  community_id INTEGER REFERENCES community(id) ON DELETE SET NULL,
  degree       INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS entity_alias (
  entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  alias     TEXT NOT NULL,
  PRIMARY KEY (entity_id, alias)
);

CREATE TABLE IF NOT EXISTS relation (
  id          INTEGER PRIMARY KEY,
  src_id      INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  dst_id      INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  weight      INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  confidence  REAL NOT NULL DEFAULT 0.5,
  UNIQUE(src_id, dst_id, type)
);
CREATE INDEX IF NOT EXISTS idx_relation_src ON relation(src_id);
CREATE INDEX IF NOT EXISTS idx_relation_dst ON relation(dst_id);

CREATE TABLE IF NOT EXISTS mention (
  id         INTEGER PRIMARY KEY,
  chunk_id   INTEGER NOT NULL REFERENCES chunk(id) ON DELETE CASCADE,
  entity_id  INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  span_start INTEGER NOT NULL,
  span_end   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mention_entity ON mention(entity_id);
CREATE INDEX IF NOT EXISTS idx_mention_chunk ON mention(chunk_id);

CREATE TABLE IF NOT EXISTS community (
  id           INTEGER PRIMARY KEY,
  level        INTEGER NOT NULL DEFAULT 0,
  label        INTEGER NOT NULL,
  fingerprint  TEXT NOT NULL,
  member_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_summary (
  community_id  INTEGER PRIMARY KEY REFERENCES community(id) ON DELETE CASCADE,
  summary       TEXT NOT NULL,
  entities_top  TEXT NOT NULL,
  generated_at  INTEGER NOT NULL,
  fingerprint_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extraction_batch (
  id          INTEGER PRIMARY KEY,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  status      TEXT NOT NULL DEFAULT 'running',
  llm_calls   INTEGER NOT NULL DEFAULT 0,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  files_total INTEGER NOT NULL DEFAULT 0,
  files_done  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quarantine (
  id           INTEGER PRIMARY KEY,
  chunk_id     INTEGER REFERENCES chunk(id) ON DELETE SET NULL,
  raw_input    TEXT NOT NULL,
  raw_output   TEXT,
  error_code   TEXT NOT NULL,
  error_detail TEXT,
  created_at   INTEGER NOT NULL,
  resolved     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS relation_evidence (
  relation_id INTEGER NOT NULL REFERENCES relation(id) ON DELETE CASCADE,
  chunk_id    INTEGER NOT NULL REFERENCES chunk(id) ON DELETE CASCADE,
  PRIMARY KEY (relation_id, chunk_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(text, path UNINDEXED, tokenize='trigram');
CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(name, tokenize='trigram');
`

// ── 实现 ─────────────────────────────────────────────────────────────────────

interface EntityRowRaw {
  id: number | bigint; norm_name: string; name: string; type: string
  description: string | null; community_id: number | bigint | null; degree: number | bigint
}
interface RelationRowRaw {
  id: number | bigint; src_id: number | bigint; dst_id: number | bigint; type: string
  weight: number | bigint; description: string | null; confidence: number
}
interface SourceRowRaw {
  id: number | bigint; path: string; abs_path: string; content_hash: string
  size_bytes: number | bigint; mtime_ms: number | bigint; state: string; error: string | null
}

const n = (v: number | bigint | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v)

export class SqliteGraphStore {
  private readonly db: DatabaseSync
  private closed = false

  constructor(location: string) {
    this.db = new DatabaseSync(location)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA foreign_keys = ON')
    this.db.exec('PRAGMA busy_timeout = 5000')
    this.migrate()
  }

  close(): void {
    if (!this.closed) { this.db.close(); this.closed = true }
  }

  // ── 迁移 ───────────────────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(SCHEMA_V1)
    this.db.exec('INSERT OR IGNORE INTO meta (key, value) VALUES (\'schema_version\', \'1\')')
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version') as { value: string }
    const version = Number(row.value)
    if (version > 1) {
      throw new Error(`SCHEMA_FUTURE: 库版本 ${version} 高于本实现（1），拒绝打开`)
    }
  }

  meta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  setMeta(key: string, value: string): void {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  // ── source / chunk 生命周期 ───────────────────────────────────────────────

  upsertSource(s: SourceInput): SourceRow {
    const existing = this.db.prepare('SELECT * FROM source WHERE path = ?').get(s.path) as SourceRowRaw | undefined
    if (existing) {
      this.db.prepare('UPDATE source SET abs_path=?, content_hash=?, size_bytes=?, mtime_ms=?, state=?, error=NULL WHERE id=?')
        .run(s.absPath, s.contentHash, BigInt(s.sizeBytes), BigInt(s.mtimeMs), 'pending', existing.id)
      return this.getSource(s.path) as SourceRow
    }
    const res = this.db.prepare(
      'INSERT INTO source (path, abs_path, content_hash, size_bytes, mtime_ms, state) VALUES (?, ?, ?, ?, ?, \'pending\')',
    ).run(s.path, s.absPath, s.contentHash, BigInt(s.sizeBytes), BigInt(s.mtimeMs))
    return { ...s, id: Number(res.lastInsertRowid), state: 'pending', error: null }
  }

  getSource(path: string): SourceRow | null {
    const r = this.db.prepare('SELECT * FROM source WHERE path = ?').get(path) as SourceRowRaw | undefined
    return r ? this.mapSource(r) : null
  }

  listSources(): readonly SourceRow[] {
    return (this.db.prepare('SELECT * FROM source ORDER BY path').all() as unknown as SourceRowRaw[]).map(r => this.mapSource(r))
  }

  private mapSource(r: SourceRowRaw): SourceRow {
    return {
      id: Number(r.id), path: r.path, absPath: r.abs_path, contentHash: r.content_hash,
      sizeBytes: Number(r.size_bytes), mtimeMs: Number(r.mtime_ms),
      state: r.state as SourceState, error: r.error,
    }
  }

  setSourceState(id: number, state: SourceState, error: string | null = null): void {
    this.db.prepare('UPDATE source SET state=?, error=? WHERE id=?').run(state, error, BigInt(id))
  }

  replaceChunks(sourceId: number, chunks: readonly ChunkInput[]): void {
    this.tx(() => {
      // FTS 清理必须在 chunk 删除之前（子查询依赖 chunk 表）
      this.db.prepare('DELETE FROM chunk_fts WHERE rowid IN (SELECT id FROM chunk WHERE source_id = ?)').run(BigInt(sourceId))
      this.db.prepare('DELETE FROM chunk WHERE source_id = ?').run(BigInt(sourceId))
      const ins = this.db.prepare(
        'INSERT INTO chunk (source_id, ordinal, start_line, end_line, start_col, end_col, text, token_est) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      const ftsIns = this.db.prepare('INSERT INTO chunk_fts (rowid, text, path) VALUES (?, ?, ?)')
      const path = (this.db.prepare('SELECT path FROM source WHERE id = ?').get(BigInt(sourceId)) as { path: string }).path
      for (const c of chunks) {
        const res = ins.run(BigInt(sourceId), BigInt(c.ordinal), BigInt(c.startLine), BigInt(c.endLine),
          BigInt(c.startCol), BigInt(c.endCol), c.text, BigInt(c.tokenEst))
        ftsIns.run(res.lastInsertRowid, c.text, path)
      }
    })
  }

  getChunks(sourceId: number): readonly ChunkRef[] {
    const rows = this.db.prepare('SELECT c.*, s.path FROM chunk c JOIN source s ON s.id = c.source_id WHERE c.source_id = ? ORDER BY c.ordinal')
      .all(BigInt(sourceId)) as Array<{ id: number | bigint; source_id: number | bigint; path: string } & Record<string, unknown>>
    return rows.map(r => ({
      id: Number(r.id), sourceId: Number(r.source_id), sourcePath: r.path as string,
      ordinal: Number(r.ordinal as number | bigint), startLine: Number(r.start_line as number | bigint),
      endLine: Number(r.end_line as number | bigint), startCol: Number(r.start_col as number | bigint),
      endCol: Number(r.end_col as number | bigint), text: r.text as string,
    }))
  }

  searchChunks(terms: readonly string[], k: number): readonly { chunk: ChunkRef; score: number }[] {
    if (terms.length === 0) return []
    const match = terms.map(t => `"${t.replaceAll('"', '""')}"`).join(' OR ')
    const hits = this.db.prepare(
      `SELECT f.rowid AS cid, bm25(chunk_fts) AS score FROM chunk_fts f WHERE chunk_fts MATCH ? ORDER BY score LIMIT ?`,
    ).all(match, BigInt(k)) as Array<{ cid: number | bigint; score: number }>
    return hits.map(h => {
      const chunk = this.getChunkById(Number(h.cid))
      return chunk ? { chunk, score: h.score } : null
    }).filter((x): x is { chunk: ChunkRef; score: number } => x !== null)
  }

  getChunkById(id: number): ChunkRef | null {
    const r = this.db.prepare('SELECT c.*, s.path FROM chunk c JOIN source s ON s.id = c.source_id WHERE c.id = ?')
      .get(BigInt(id)) as Record<string, unknown> | undefined
    if (!r) return null
    return {
      id: Number(r.id as number | bigint), sourceId: Number(r.source_id as number | bigint), sourcePath: r.path as string,
      ordinal: Number(r.ordinal as number | bigint), startLine: Number(r.start_line as number | bigint),
      endLine: Number(r.end_line as number | bigint), startCol: Number(r.start_col as number | bigint),
      endCol: Number(r.end_col as number | bigint), text: r.text as string,
    }
  }

  // ── 图写入：applyExtraction（单事务）──────────────────────────────────────

  /** 实体 upsert + 关系聚合 + mention + 证据关联，一个事务。
   * 崩溃/异常整体回滚（0202 §4 事务边界约定）。 */
  applyExtraction(delta: ExtractionDelta): void {
    this.tx(() => {
      const idByNorm = new Map<string, number>()
      for (const e of delta.entities) {
        const id = this.upsertEntityTx(e)
        idByNorm.set(e.normName, id)
      }
      for (const rel of delta.relations) {
        const src = idByNorm.get(rel.srcNorm) ?? this.getEntityId(rel.srcNorm)
        const dst = idByNorm.get(rel.dstNorm) ?? this.getEntityId(rel.dstNorm)
        if (src === undefined || dst === undefined) continue // 端点未抽取到，跳过
        this.upsertRelationTx(src, dst, rel, delta.chunkId)
        this.bumpDegreeTx(src, 1)
        this.bumpDegreeTx(dst, 1)
      }
      for (const m of delta.mentions) {
        const id = idByNorm.get(m.normName) ?? this.getEntityId(m.normName)
        if (id === undefined) continue
        this.db.prepare('INSERT INTO mention (chunk_id, entity_id, span_start, span_end) VALUES (?, ?, ?, ?)')
          .run(BigInt(delta.chunkId), BigInt(id), BigInt(m.spanStart), BigInt(m.spanEnd))
      }
      this.setSourceState(delta.sourceId, 'extracted')
    })
  }

  private upsertEntityTx(e: EntityUpsert): number {
    const existing = this.db.prepare('SELECT id FROM entity WHERE norm_name = ?').get(e.normName) as { id: number | bigint } | undefined
    if (existing) {
      const id = Number(existing.id)
      // 描述归并（0203 §1.6 简化）：先到先得，空缺补位
      if (e.description !== null) {
        this.db.prepare('UPDATE entity SET description = COALESCE(description, ?) WHERE id = ?').run(e.description, BigInt(id))
      }
      if (e.name !== e.normName) {
        this.db.prepare('INSERT OR IGNORE INTO entity_alias (entity_id, alias) VALUES (?, ?)').run(BigInt(id), e.name)
      }
      return id
    }
    const res = this.db.prepare('INSERT INTO entity (norm_name, name, type, description) VALUES (?, ?, ?, ?)')
      .run(e.normName, e.name, e.type, e.description)
    const id = Number(res.lastInsertRowid)
    this.db.prepare('INSERT INTO entity_fts (rowid, name) VALUES (?, ?)').run(res.lastInsertRowid, e.name)
    if (e.name !== e.normName) {
      this.db.prepare('INSERT OR IGNORE INTO entity_alias (entity_id, alias) VALUES (?, ?)').run(BigInt(id), e.name)
    }
    return id
  }

  private getEntityId(normName: string): number | undefined {
    const r = this.db.prepare('SELECT id FROM entity WHERE norm_name = ?').get(normName) as { id: number | bigint } | undefined
    return r === undefined ? undefined : Number(r.id)
  }

  private upsertRelationTx(src: number, dst: number, rel: RelationUpsert, chunkId: number): void {
    const existing = this.db.prepare('SELECT id, weight, confidence FROM relation WHERE src_id=? AND dst_id=? AND type=?')
      .get(BigInt(src), BigInt(dst), rel.type) as { id: number | bigint; weight: number | bigint; confidence: number } | undefined
    let relId: number
    if (existing) {
      relId = Number(existing.id)
      const w = Number(existing.weight)
      const c = Number(existing.confidence)
      const newConf = (c * w + rel.confidence) / (w + 1) // 加权均值（0203 §1.6）
      this.db.prepare('UPDATE relation SET weight = weight + 1, confidence = ?, description = COALESCE(description, ?) WHERE id = ?')
        .run(newConf, rel.description, BigInt(relId))
    } else {
      const res = this.db.prepare('INSERT INTO relation (src_id, dst_id, type, weight, description, confidence) VALUES (?, ?, ?, 1, ?, ?)')
        .run(BigInt(src), BigInt(dst), rel.type, rel.description, rel.confidence)
      relId = Number(res.lastInsertRowid)
    }
    this.db.prepare('INSERT OR IGNORE INTO relation_evidence (relation_id, chunk_id) VALUES (?, ?)').run(BigInt(relId), BigInt(chunkId))
  }

  private bumpDegreeTx(id: number, delta: number): void {
    this.db.prepare('UPDATE entity SET degree = degree + ? WHERE id = ?').run(BigInt(delta), BigInt(id))
  }

  // ── 图读取 ─────────────────────────────────────────────────────────────────

  private mapEntity(r: EntityRowRaw): Entity {
    return {
      id: Number(r.id), normName: r.norm_name, name: r.name, type: r.type as EntityType,
      description: r.description, communityId: n(r.community_id), degree: Number(r.degree),
    }
  }

  private mapRelation(r: RelationRowRaw): Relation {
    return {
      id: Number(r.id), srcId: Number(r.src_id), dstId: Number(r.dst_id), type: r.type as RelationType,
      weight: Number(r.weight), description: r.description, confidence: Number(r.confidence),
    }
  }

  getEntity(normName: string): Entity | null {
    const r = this.db.prepare('SELECT * FROM entity WHERE norm_name = ?').get(normName) as EntityRowRaw | undefined
    return r ? this.mapEntity(r) : null
  }

  findEntitiesByLexical(terms: readonly string[], limit: number): readonly EntityHit[] {
    if (terms.length === 0) return []
    const match = terms.map(t => `"${t.replaceAll('"', '""')}"`).join(' OR ')
    const rows = this.db.prepare(
      `SELECT e.*, bm25(entity_fts) AS score FROM entity_fts f JOIN entity e ON e.id = f.rowid
       WHERE entity_fts MATCH ? ORDER BY score LIMIT ?`,
    ).all(match, BigInt(limit)) as unknown as Array<EntityRowRaw & { score: number }>
    return rows.map(r => ({ entity: this.mapEntity(r), score: r.score }))
  }

  neighbors(id: number, dir: 'out' | 'in' | 'both', types?: readonly string[]): readonly EdgeRow[] {
    const conds: string[] = []
    const params: (string | bigint)[] = []
    if (dir === 'out') conds.push('r.src_id = ?')
    else if (dir === 'in') conds.push('r.dst_id = ?')
    else conds.push('(r.src_id = ? OR r.dst_id = ?)')
    params.push(BigInt(id))
    if (dir === 'both') params.push(BigInt(id))
    if (types && types.length > 0) {
      conds.push(`r.type IN (${types.map(() => '?').join(',')})`)
      params.push(...types)
    }
    const rows = this.db.prepare(
      `SELECT r.*, se.name AS src_name, de.name AS dst_name FROM relation r
       JOIN entity se ON se.id = r.src_id JOIN entity de ON de.id = r.dst_id
       WHERE ${conds.join(' AND ')} ORDER BY r.weight DESC`,
    ).all(...params) as unknown as Array<RelationRowRaw & { src_name: string; dst_name: string }>
    return rows.map(r => ({ relation: this.mapRelation(r), srcName: r.src_name, dstName: r.dst_name }))
  }

  /** BFS 遍历：节点预算硬上限 + 截断标记（0203 §2.3）。 */
  bfs(startIds: readonly number[], hops: number, dir: 'out' | 'in' | 'both',
    types: readonly string[] | undefined, budget: number): SubgraphRows {
    const visited = new Set<number>(startIds)
    let frontier = [...startIds]
    const edges: EdgeRow[] = []
    let truncated = false
    for (let h = 0; h < hops; h++) {
      const next: number[] = []
      for (const node of frontier) {
        for (const edge of this.neighbors(node, dir, types)) {
          const other = edge.relation.srcId === node ? edge.relation.dstId : edge.relation.srcId
          edges.push(edge)
          if (!visited.has(other)) {
            if (visited.size >= budget) { truncated = true; continue }
            visited.add(other)
            next.push(other)
          }
        }
      }
      if (next.length === 0) break
      frontier = next
    }
    const nodes = [...visited].map(id => this.getEntityById(id)).filter((e): e is Entity => e !== null)
    return { nodes, edges: dedupeEdges(edges), truncated }
  }

  getEntityById(id: number): Entity | null {
    const r = this.db.prepare('SELECT * FROM entity WHERE id = ?').get(BigInt(id)) as EntityRowRaw | undefined
    return r ? this.mapEntity(r) : null
  }

  chunksForEntities(ids: readonly number[], limitPerEntity: number): readonly ChunkRef[] {
    const out: ChunkRef[] = []
    const seen = new Set<number>()
    for (const id of ids) {
      const rows = this.db.prepare(
        `SELECT c.* FROM mention m JOIN chunk c ON c.id = m.chunk_id WHERE m.entity_id = ? LIMIT ?`,
      ).all(BigInt(id), BigInt(limitPerEntity)) as Array<Record<string, unknown>>
      for (const r of rows) {
        const cid = Number(r.id as number | bigint)
        if (seen.has(cid)) continue
        seen.add(cid)
        const chunk = this.getChunkById(cid)
        if (chunk) out.push(chunk)
      }
    }
    return out
  }

  allEntities(): readonly Entity[] {
    return (this.db.prepare('SELECT * FROM entity').all() as unknown as EntityRowRaw[]).map(r => this.mapEntity(r))
  }

  entitiesByCommunity(communityId: number, limit = 50): readonly Entity[] {
    return (this.db.prepare('SELECT * FROM entity WHERE community_id = ? ORDER BY degree DESC LIMIT ?')
      .all(BigInt(communityId), BigInt(limit)) as unknown as EntityRowRaw[]).map(r => this.mapEntity(r))
  }

  communityOf(communityId: number): Community | null {
    const r = this.db.prepare('SELECT * FROM community WHERE id = ?').get(BigInt(communityId)) as Record<string, unknown> | undefined
    if (!r) return null
    return {
      id: Number(r.id as number | bigint), level: Number(r.level as number | bigint),
      label: Number(r.label as number | bigint), fingerprint: r.fingerprint as string,
      memberCount: Number(r.member_count as number | bigint),
    }
  }

  /** 实体搜索（浏览页前缀/子串检索，FTS 命中 + LIKE 兜底）。 */
  searchEntityCards(terms: readonly string[], limit: number): readonly EntityRowRaw[] {
    const match = terms.map(t => `"${t.replaceAll('"', '""')}"`).join(' OR ')
    const byFts = this.db.prepare(
      `SELECT e.* FROM entity_fts f JOIN entity e ON e.id = f.rowid WHERE entity_fts MATCH ? ORDER BY e.degree DESC LIMIT ?`,
    ).all(match, BigInt(limit)) as unknown as EntityRowRaw[]
    if (byFts.length > 0) return byFts
    const likes = terms.map(() => 'norm_name LIKE ?').join(' OR ')
    const params = terms.map(t => `%${t.toLowerCase()}%`)
    return this.db.prepare(
      `SELECT * FROM entity WHERE ${likes} ORDER BY degree DESC LIMIT ?`,
    ).all(...params, BigInt(limit)) as unknown as EntityRowRaw[]
  }

  /** 浏览页抽样审查：按置信度升序抽 N 条关系（低置信优先，确定性）。 */
  sampleRelations(limit: number, excludeIds: readonly number[]): readonly { relation: Relation; srcName: string; dstName: string }[] {
    const excl = excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map(() => '?').join(',')})` : ''
    const params: (number | bigint)[] = [...excludeIds.map(BigInt), BigInt(limit)]
    const rows = this.db.prepare(
      `SELECT * FROM relation WHERE confidence < 1.0 ${excl} ORDER BY confidence ASC, id ASC LIMIT ?`,
    ).all(...params) as unknown as RelationRowRaw[]
    const need = limit - rows.length
    let rest = rows
    if (need > 0) {
      const full = this.db.prepare(
        `SELECT * FROM relation WHERE confidence >= 1.0 ${excl} ORDER BY id ASC LIMIT ?`,
      ).all(...params) as unknown as RelationRowRaw[]
      rest = [...rows, ...full]
    }
    return rest.map(r => {
      const rel = this.mapRelation(r)
      const src = this.getEntityById(rel.srcId)
      const dst = this.getEntityById(rel.dstId)
      return { relation: rel, srcName: src?.name ?? '?', dstName: dst?.name ?? '?' }
    })
  }

  /** 关系的 mention 原文（审查页右栏）。 */
  relationEvidence(relationId: number): readonly { path: string; startLine: number; endLine: number; text: string; spanStart: number | null; spanEnd: number | null }[] {
    // 注意扇出：同 chunk 内 src/dst 端点各有多条 mention 时 JOIN 会翻倍，
    // 按 chunk 去重（保留最早 mention span），一条证据 = 一个 chunk。
    const rows = this.db.prepare(
      `SELECT re.chunk_id AS chunkId, s.path, c.start_line, c.end_line, c.text, m.span_start AS spanStart, m.span_end AS spanEnd
       FROM relation_evidence re
       JOIN chunk c ON c.id = re.chunk_id
       JOIN source s ON s.id = c.source_id
       LEFT JOIN mention m ON m.chunk_id = re.chunk_id AND (m.entity_id = (SELECT src_id FROM relation WHERE id = ?) OR m.entity_id = (SELECT dst_id FROM relation WHERE id = ?))
       WHERE re.relation_id = ? LIMIT 12`,
    ).all(BigInt(relationId), BigInt(relationId), BigInt(relationId)) as Array<Record<string, unknown>>
    const byChunk = new Map<number, { path: string; startLine: number; endLine: number; text: string; spanStart: number | null; spanEnd: number | null }>()
    for (const r of rows) {
      const chunkId = Number(r.chunkId as number | bigint)
      if (byChunk.has(chunkId)) continue
      byChunk.set(chunkId, {
        path: r.path as string,
        startLine: Number(r.start_line as number | bigint),
        endLine: Number(r.end_line as number | bigint),
        text: r.text as string,
        spanStart: r.spanStart === null || r.spanStart === undefined ? null : Number(r.spanStart as number | bigint),
        spanEnd: r.spanEnd === null || r.spanEnd === undefined ? null : Number(r.spanEnd as number | bigint),
      })
    }
    return [...byChunk.values()]
  }

  /** 给定实体集内部的边（local 证据组装用）。 */
  relationsAmong(entityIds: ReadonlySet<number>, limit = 40): readonly EdgeRow[] {
    if (entityIds.size === 0) return []
    const ph = [...entityIds].map(() => '?').join(',')
    const params = [...entityIds].map(BigInt)
    const rows = this.db.prepare(
      `SELECT r.*, se.name AS src_name, de.name AS dst_name FROM relation r
       JOIN entity se ON se.id = r.src_id JOIN entity de ON de.id = r.dst_id
       WHERE r.src_id IN (${ph}) AND r.dst_id IN (${ph}) ORDER BY r.weight DESC LIMIT ?`,
    ).all(...params, ...params, BigInt(limit)) as unknown as Array<RelationRowRaw & { src_name: string; dst_name: string }>
    return rows.map(r => ({ relation: this.mapRelation(r), srcName: r.src_name, dstName: r.dst_name }))
  }

  /** chunk 内被提及的实体 id（chunk FTS 反查种子的桥，0203 §2.1）。 */
  entitiesInChunk(chunkId: number): readonly number[] {
    const rows = this.db.prepare('SELECT entity_id FROM mention WHERE chunk_id = ?').all(BigInt(chunkId)) as unknown as Array<{ entity_id: number | bigint }>
    return rows.map(r => Number(r.entity_id))
  }

  /** 实体某条关系的一条原文证据（mention chunk 引用）。 */
  evidenceChunkFor(entityId: number): ChunkRef | null {
    const chunk = this.chunksForEntities([entityId], 1)
    return chunk[0] ?? null
  }

  allRelations(): readonly Relation[] {
    return (this.db.prepare('SELECT * FROM relation').all() as unknown as RelationRowRaw[]).map(r => this.mapRelation(r))
  }

  // ── 社区（读/写；重算随 lpa.ts 于 W4 提供）───────────────────────────────

  putCommunity(c: Omit<Community, 'id'>): number {
    const res = this.db.prepare('INSERT INTO community (level, label, fingerprint, member_count) VALUES (?, ?, ?, ?)')
      .run(BigInt(c.level), BigInt(c.label), c.fingerprint, BigInt(c.memberCount))
    return Number(res.lastInsertRowid)
  }

  clearCommunities(): void {
    this.tx(() => {
      this.db.prepare('DELETE FROM community_summary').run()
      this.db.prepare('UPDATE entity SET community_id = NULL').run()
      this.db.prepare('DELETE FROM community').run()
    })
  }

  assignCommunity(entityId: number, communityId: number): void {
    this.db.prepare('UPDATE entity SET community_id = ? WHERE id = ?').run(BigInt(communityId), BigInt(entityId))
  }

  listCommunities(): readonly Community[] {
    const rows = this.db.prepare('SELECT * FROM community ORDER BY id').all() as Array<Record<string, unknown>>
    return rows.map(r => ({
      id: Number(r.id as number | bigint), level: Number(r.level as number | bigint),
      label: Number(r.label as number | bigint), fingerprint: r.fingerprint as string,
      memberCount: Number(r.member_count as number | bigint),
    }))
  }

  putSummary(s: CommunitySummaryInput): void {
    this.db.prepare(
      `INSERT INTO community_summary (community_id, summary, entities_top, generated_at, fingerprint_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(community_id) DO UPDATE SET summary=excluded.summary, entities_top=excluded.entities_top,
         generated_at=excluded.generated_at, fingerprint_at=excluded.fingerprint_at`,
    ).run(BigInt(s.communityId), s.summary, JSON.stringify(s.entitiesTop), BigInt(Date.now()), s.fingerprintAt)
  }

  allSummaries(): readonly CommunitySummary[] {
    const rows = this.db.prepare('SELECT * FROM community_summary').all() as Array<Record<string, unknown>>
    return rows.map(r => ({
      communityId: Number(r.community_id as number | bigint), summary: r.summary as string,
      entitiesTop: JSON.parse(r.entities_top as string) as string[],
      generatedAt: Number(r.generated_at as number | bigint), fingerprintAt: r.fingerprint_at as string,
    }))
  }

  // ── 隔离区 ─────────────────────────────────────────────────────────────────

  quarantinePut(chunkId: number | null, rawInput: string, rawOutput: string | null,
    errorCode: QuarantineErrorCode, errorDetail: string | null): void {
    this.db.prepare(
      'INSERT INTO quarantine (chunk_id, raw_input, raw_output, error_code, error_detail, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?, 0)',
    ).run(chunkId === null ? null : BigInt(chunkId), rawInput, rawOutput, errorCode, errorDetail, BigInt(Date.now()))
  }

  quarantineList(includeResolved = false): readonly QuarantineEntry[] {
    const rows = (includeResolved
      ? this.db.prepare('SELECT * FROM quarantine ORDER BY id')
      : this.db.prepare('SELECT * FROM quarantine WHERE resolved = 0 ORDER BY id')).all() as Array<Record<string, unknown>>
    return rows.map(r => ({
      id: Number(r.id as number | bigint), chunkId: n(r.chunk_id as number | bigint | null),
      rawInput: r.raw_input as string, rawOutput: r.raw_output as string | null,
      errorCode: r.error_code as QuarantineErrorCode, errorDetail: r.error_detail as string | null,
      createdAt: Number(r.created_at as number | bigint), resolved: Number(r.resolved as number | bigint) === 1,
    }))
  }

  quarantineResolve(id: number): void {
    this.db.prepare('UPDATE quarantine SET resolved = 1 WHERE id = ?').run(BigInt(id))
  }

  // ── checkpoint（extraction_batch）─────────────────────────────────────────

  startBatch(filesTotal: number): number {
    const res = this.db.prepare('INSERT INTO extraction_batch (started_at, status, files_total) VALUES (?, \'running\', ?)')
      .run(BigInt(Date.now()), BigInt(filesTotal))
    return Number(res.lastInsertRowid)
  }

  finishBatch(id: number, status: 'done' | 'aborted' | 'failed', cost: { llmCalls: number; tokensIn: number; tokensOut: number }): void {
    this.db.prepare('UPDATE extraction_batch SET finished_at=?, status=?, llm_calls=?, tokens_in=?, tokens_out=? WHERE id=?')
      .run(BigInt(Date.now()), status, BigInt(cost.llmCalls), BigInt(cost.tokensIn), BigInt(cost.tokensOut), BigInt(id))
  }

  /** 恢复扫描：残留 running 批次标记 aborted（0203 §1.1）。 */
  recoverInterruptedBatches(): number {
    const res = this.db.prepare("UPDATE extraction_batch SET status='aborted', finished_at=? WHERE status='running'")
      .run(BigInt(Date.now()))
    return Number(res.changes)
  }

  listBatches(): readonly { id: number; status: string; llmCalls: number }[] {
    const rows = this.db.prepare('SELECT id, status, llm_calls FROM extraction_batch ORDER BY id').all() as Array<Record<string, unknown>>
    return rows.map(r => ({ id: Number(r.id as number | bigint), status: r.status as string, llmCalls: Number(r.llm_calls as number | bigint) }))
  }

  // ── 治理：forget ──────────────────────────────────────────────────────────

  forget(target: ForgetTarget): ForgetReport {
    return this.tx(() => {
      if (target.kind === 'graph') {
        const before = this.counts()
        this.db.exec(`DELETE FROM mention; DELETE FROM relation_evidence; DELETE FROM relation; DELETE FROM entity_alias;
          DELETE FROM entity; DELETE FROM community_summary; DELETE FROM community; DELETE FROM quarantine;
          DELETE FROM chunk_fts; DELETE FROM entity_fts;
          DELETE FROM chunk; DELETE FROM source;`)
        return {
          deleted: {
            chunks: before.chunks, mentions: before.mentions, relations: before.relations,
            entities: before.entities, summaries: before.summaries,
          },
          communitiesRebuilt: before.communities,
        }
      }
      if (target.kind === 'file') {
        const src = this.getSource(target.path)
        if (!src) return { deleted: { chunks: 0, mentions: 0, relations: 0, entities: 0, summaries: 0 }, communitiesRebuilt: 0 }
        const chunkIds = (this.db.prepare('SELECT id FROM chunk WHERE source_id = ?').all(BigInt(src.id)) as Array<{ id: number | bigint }>).map(r => Number(r.id))
        const mentions = Number((this.db.prepare('SELECT COUNT(*) AS c FROM mention WHERE chunk_id IN (SELECT id FROM chunk WHERE source_id = ?)')
          .get(BigInt(src.id)) as { c: number | bigint }).c)
        // 证据清扫 → 零证据关系删除（weight 语义等价递减）；FTS 先于 chunk 清理（rowid 复用防冲突）
        this.db.prepare('DELETE FROM chunk_fts WHERE rowid IN (SELECT id FROM chunk WHERE source_id = ?)').run(BigInt(src.id))
        this.db.prepare('DELETE FROM relation_evidence WHERE chunk_id IN (SELECT id FROM chunk WHERE source_id = ?)').run(BigInt(src.id))
        this.db.prepare('DELETE FROM relation WHERE id NOT IN (SELECT DISTINCT relation_id FROM relation_evidence)').run()
        this.db.prepare('DELETE FROM source WHERE id = ?').run(BigInt(src.id)) // ON DELETE CASCADE: chunk + mention
        const entities = this.cleanupOrphanEntities()
        void chunkIds
        return { deleted: { chunks: chunkIds.length, mentions, relations: 0, entities, summaries: 0 }, communitiesRebuilt: 0 }
      }
      // entity
      const ent = this.getEntity(normOf(target.name))
      if (!ent) return { deleted: { chunks: 0, mentions: 0, relations: 0, entities: 0, summaries: 0 }, communitiesRebuilt: 0 }
      const relations = Number((this.db.prepare('SELECT COUNT(*) AS c FROM relation WHERE src_id=? OR dst_id=?')
        .get(BigInt(ent.id), BigInt(ent.id)) as { c: number | bigint }).c)
      const mentions = Number((this.db.prepare('SELECT COUNT(*) AS c FROM mention WHERE entity_id = ?')
        .get(BigInt(ent.id)) as { c: number | bigint }).c)
      this.db.prepare('DELETE FROM entity_fts WHERE rowid = ?').run(BigInt(ent.id))
      this.db.prepare('DELETE FROM entity WHERE id = ?').run(BigInt(ent.id)) // CASCADE: relation/alias/mention
      return { deleted: { chunks: 0, mentions, relations, entities: 1, summaries: 0 }, communitiesRebuilt: 0 }
    })
  }

  /** 审查排除：标记关系（检索组装时过滤），可逆。 */
  excludeRelation(id: number): void {
    this.db.prepare('UPDATE relation SET confidence = -1 WHERE id = ?').run(BigInt(id))
  }

  /** 人工更正：改关系端点/类型（实体按名 upsert，缺失即建 concept 实体），
   * 置信度置 1（人工确认，同时清除排除态），并全量重算度数。
   * 返回是否有字段实际变化。 */
  updateRelationEnds(id: number, next: { readonly srcName?: string; readonly type?: string; readonly dstName?: string }): { readonly changed: boolean } {
    const row = this.db.prepare('SELECT src_id, dst_id, type FROM relation WHERE id = ?')
      .get(BigInt(id)) as { src_id: number | bigint; dst_id: number | bigint; type: string } | undefined
    if (row === undefined) return { changed: false }
    const srcName = next.srcName
    const dstName = next.dstName
    const relType = next.type
    if ((srcName === undefined || srcName.trim() === '') && (dstName === undefined || dstName.trim() === '') && (relType === undefined || relType.trim() === '')) {
      return { changed: false }
    }
    const resolveEnd = (name: string): number => {
      const norm = normName(name)
      const existing = this.getEntityId(norm)
      if (existing !== undefined) return existing
      return this.upsertEntityTx({ normName: norm, name, type: 'concept', description: null, confidence: 1 })
    }
    const srcId = srcName !== undefined && srcName.trim() !== '' ? resolveEnd(srcName.trim()) : Number(row.src_id)
    const dstId = dstName !== undefined && dstName.trim() !== '' ? resolveEnd(dstName.trim()) : Number(row.dst_id)
    const newType = relType !== undefined && relType.trim() !== '' ? relType.trim() : row.type
    const changed = srcId !== Number(row.src_id) || dstId !== Number(row.dst_id) || newType !== row.type
    if (!changed) return { changed: false }
    this.db.prepare('UPDATE relation SET src_id = ?, dst_id = ?, type = ?, confidence = 1 WHERE id = ?')
      .run(BigInt(srcId), BigInt(dstId), newType, BigInt(id))
    // 更正可能引入/迁移端点：全量重算度数（cleanupOrphanEntities 同式）。
    this.db.exec(`UPDATE entity SET degree = (SELECT COUNT(*) FROM relation r WHERE r.src_id = entity.id OR r.dst_id = entity.id)`)
    return { changed: true }
  }

  excludedRelationCount(): number {
    return Number((this.db.prepare('SELECT COUNT(*) AS c FROM relation WHERE confidence < 0').get() as { c: number | bigint }).c)
  }

  /** 孤儿清理：无 mention 且度为 0 的实体（0203 §1.6）。返回删除数。
   * 先重算度数再删（关系可能已被证据清扫移除）；entity_fts 同步清理。 */
  cleanupOrphanEntities(): number {
    this.db.exec(`UPDATE entity SET degree = (SELECT COUNT(*) FROM relation r WHERE r.src_id = entity.id OR r.dst_id = entity.id)`)
    const rows = this.db.prepare('SELECT id FROM entity WHERE degree <= 0 AND id NOT IN (SELECT DISTINCT entity_id FROM mention)')
      .all() as unknown as Array<{ id: number | bigint }>
    const ids = rows.map(r => Number(r.id))
    if (ids.length > 0) {
      const ph = ids.map(() => '?').join(',')
      this.db.prepare(`DELETE FROM entity_fts WHERE rowid IN (${ph})`).run(...ids.map(BigInt))
      this.db.prepare(`DELETE FROM entity WHERE id IN (${ph})`).run(...ids.map(BigInt))
    }
    return ids.length
  }

  counts(): { sources: number; chunks: number; entities: number; relations: number; mentions: number; communities: number; summaries: number } {
    const c = (t: string): number => Number((this.db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number | bigint }).c)
    return {
      sources: c('source'), chunks: c('chunk'), entities: c('entity'), relations: c('relation'),
      mentions: c('mention'), communities: c('community'), summaries: c('community_summary'),
    }
  }

  // ── 事务 ───────────────────────────────────────────────────────────────────

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const out = fn()
      this.db.exec('COMMIT')
      return out
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }
}

function normOf(name: string): string {
  return name.trim().toLowerCase().replace(/[\s`*_\-./\\()[\]{}<>"'!?,;:]+/g, '')
}

function dedupeEdges(edges: readonly EdgeRow[]): EdgeRow[] {
  const seen = new Set<number>()
  const out: EdgeRow[] = []
  for (const e of edges) {
    if (seen.has(e.relation.id)) continue
    seen.add(e.relation.id)
    out.push(e)
  }
  return out
}
