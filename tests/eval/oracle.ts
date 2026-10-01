/** Oracle 抽取器（评测专用）：从冻结的黄金 spec 派生"完美抽取"，零 LLM、
 * 逐字节确定（docs/02-design/0206 §2.1 录制/回放的替代实现）。
 *
 * 目的：把"检索管线质量"（建图/PPR/LPA/local-global）与"LLM 抽取质量"
 * 解耦——graph-local / graph-full 配置用 oracle 建图，测的是检索本身；
 * 真实 LLM 的抽取质量另行在宿主冒烟中评估（抽取 vs oracle 的差集）。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { chunkText } from '../../src/core/chunker.ts'
import { computeMentions } from '../../src/core/extractor.ts'
import { SqliteGraphStore, type ChunkInput, type ExtractionDelta } from '../../src/core/graphstore.ts'
import { recomputeCommunities } from '../../src/core/lpa.ts'
import { normName, type RelationType } from '../../src/core/types.ts'

const ROOT = new URL('../..', import.meta.url).pathname

interface SpecEntity {
  readonly id: string
  readonly zh: string
  readonly en: string
  readonly type: 'module' | 'concept'
}
interface SpecRelation {
  readonly s: string
  readonly r: RelationType
  readonly o: string
  readonly desc: string
}

function loadKnowledgeSpec(): { entities: SpecEntity[]; relations: SpecRelation[] } {
  const raw = JSON.parse(readFileSync(join(ROOT, 'tests/eval/golden/knowledge-spec.json'), 'utf8')) as {
    modules: { id: string; zh: string; en: string }[]
    concepts: { id: string; zh: string; en: string }[]
    relations: SpecRelation[]
  }
  const entities: SpecEntity[] = [
    ...raw.modules.map(m => ({ id: m.id, zh: m.zh, en: m.en, type: 'module' as const })),
    ...raw.concepts.map(c => ({ id: c.id, zh: c.zh, en: c.en, type: 'concept' as const })),
  ]
  return { entities, relations: raw.relations }
}

/** 代码文件的规范路径与 import 边（与生成器口径一致：'../x/y.js' → 'src/x/y.ts'）。 */
function parseImports(path: string, text: string): { imports: string[]; specifiers: string[] } {
  const dir = path.slice(0, path.lastIndexOf('/'))
  const imports: string[] = []
  const specifiers: string[] = []
  for (const m of text.matchAll(/from '([^']+)'/g)) {
    const spec = m[1] as string
    if (!spec.startsWith('.')) continue
    const segs = spec.slice(0, -3).split('/') // 去 .js
    const base = dir.split('/')
    for (const seg of segs.slice(0, -1)) {
      if (seg === '..') base.pop()
      else if (seg !== '.') base.push(seg)
    }
    const file = segs[segs.length - 1]
    if (file === undefined) continue
    imports.push([...base, `${file}.ts`].join('/'))
    specifiers.push(spec)
  }
  return { imports, specifiers }
}

/** 用 oracle 建图：knowledge 语料按 spec 实体/关系回放，codebase 按 import 边回放。 */
export function buildOracleStore(withCommunities: boolean): SqliteGraphStore {
  const store = new SqliteGraphStore(':memory:')
  const { entities: specEntities, relations: specRelations } = loadKnowledgeSpec()
  const byId = new Map(specEntities.map(e => [e.id, e]))
  const corpus: { root: string; kind: 'knowledge' | 'code' }[] = [
    { root: join(ROOT, 'tests/eval/fixtures/fixture-knowledge'), kind: 'knowledge' },
    { root: join(ROOT, 'tests/eval/fixtures/fixture-codebase'), kind: 'code' },
  ]
  for (const { root, kind } of corpus) {
    for (const f of walkFilesImpl(root)) {
      const text = readFileSync(f.abs, 'utf8')
      const src = store.upsertSource({ path: f.path, absPath: f.abs, contentHash: `oracle-${f.path}`, sizeBytes: text.length, mtimeMs: 0 })
      const chunks = chunkText(f.path, text, { targetTokens: 900, maxTokens: 1200 })
      store.replaceChunks(src.id, chunks as unknown as ChunkInput[])
      const chunkRows = store.getChunks(src.id)

      chunkRows.forEach((chunkRow, i) => {
        const c = chunks[i] as { text: string; startLine: number; endLine: number; startCol: number; endCol: number; ordinal: number; tokenEst: number }
        const body = c.text
        let delta: ExtractionDelta
        if (kind === 'knowledge') {
          // 实体：zh/en 名出现在 chunk 文本中
          const present = specEntities.filter(e => body.includes(e.zh) || body.includes(e.en))
          const names = present.flatMap(e => [e.zh, e.en]).filter(n2 => body.includes(n2))
          const rels = specRelations
            .filter(r => present.some(p => p.id === r.s) && present.some(p => p.id === r.o))
            .filter(r => {
              const s = byId.get(r.s) as SpecEntity
              const o = byId.get(r.o) as SpecEntity
              return (body.includes(s.zh) || body.includes(s.en)) && (body.includes(o.zh) || body.includes(o.en))
            })
          delta = {
            sourceId: src.id, chunkId: chunkRow.id,
            entities: present.map(e => ({ normName: e.zh, name: e.zh, type: e.type, description: e.id === 'mq' ? '异步事件骨干' : null, confidence: 1 })),
            relations: rels.map(r => ({
              srcNorm: (byId.get(r.s) as SpecEntity).zh, dstNorm: (byId.get(r.o) as SpecEntity).zh,
              type: r.r, description: r.desc, confidence: 1,
            })),
            mentions: computeMentions(body, [...new Set(names)]),
          }
        } else {
          // 代码：实体 = 文件（规范路径，normName 归一），关系 = imports；mention 定位到 import 说明符
          const { imports, specifiers } = parseImports(f.path, body)
          const allFiles = [f.path, ...imports]
          const mentions: { normName: string; spanStart: number; spanEnd: number }[] = []
          const lower = body.toLowerCase()
          specifiers.forEach((spec, si) => {
            const at = lower.indexOf(spec.toLowerCase())
            const target = imports[si]
            if (at >= 0 && target !== undefined) mentions.push({ normName: normName(target), spanStart: at, spanEnd: at + spec.length })
          })
          delta = {
            sourceId: src.id, chunkId: chunkRow.id,
            entities: allFiles.map(p => ({ normName: normName(p), name: p, type: 'file' as const, description: null, confidence: 1 })),
            relations: imports.map(t => ({ srcNorm: normName(f.path), dstNorm: normName(t), type: 'imports' as const, description: null, confidence: 1 })),
            mentions,
          }
        }
        if (delta.entities.length > 0 || delta.relations.length > 0) store.applyExtraction(delta)
      })
    }
  }

  if (withCommunities) {
    recomputeCommunities(store)
    // 确定性摘要（评测用；生产走 LLM，见 0203 §1.8）
    for (const c of store.listCommunities()) {
      const names = store.entitiesByCommunity(c.id, 8).map(e => e.name)
      store.putSummary({
        communityId: c.id,
        summary: `该社区围绕 ${names.join('、')} 形成协作主题。${c.memberCount} 个成员。`,
        entitiesTop: names.slice(0, 5),
        fingerprintAt: c.fingerprint,
      })
    }
  }
  return store
}

function walkFilesImpl(dir: string): { path: string; abs: string }[] {
  const out: { path: string; abs: string }[] = []
  const walk = (d: string, base: string): void => {
    for (const name of readdirSync(d).sort()) {
      const abs = join(d, name)
      if (statSync(abs).isDirectory()) walk(abs, base)
      else out.push({ path: abs.slice(base.length + 1), abs })
    }
  }
  walk(dir, dir)
  return out
}
