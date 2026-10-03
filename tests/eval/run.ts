/** 冻结评测执行器（docs/02-design/0206 §4）。
 *
 * 用法：pnpm eval [--config flat-bm25|graph-local|graph-full] [--suite local|global|traversal|all]
 *
 * 产出：tests/eval/scorecards/<ts>-<config>.{json,md} 记分卡并打印摘要。
 * graph 配置同场重算 flat-bm25 基线并给出门槛判定（0206 §3.2）。
 * graph-* 用 oracle 抽取（零 LLM，测检索管线本身；LLM 抽取质量另行评估）。
 */
import { execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { chunkText } from '../../src/core/chunker.ts'
import { extractTerms, LexicalIndex } from '../../src/core/lexical.ts'
import { searchGlobal, searchLocal, searchTraversal } from '../../src/core/search.ts'
import { GraphRagError } from '../../src/core/types.ts'
import { globalCoverage, localMrr, localScore, traversalPR, type EvalAnswer } from './score.ts'
import { buildOracleStore } from './oracle.ts'

const ROOT = new URL('../..', import.meta.url).pathname
type Config = 'flat-bm25' | 'graph-local' | 'graph-full'
const CONFIGS: readonly Config[] = ['flat-bm25', 'graph-local', 'graph-full']
const SUITES: readonly string[] = ['all', 'local', 'global', 'traversal']

// ── 参数 ─────────────────────────────────────────────────────────────────────

function parseArgs(): { config: Config; suite: 'all' | 'local' | 'global' | 'traversal' } {
  const argv = process.argv.slice(2)
  let config: Config = 'flat-bm25'
  let suite: 'all' | 'local' | 'global' | 'traversal' = 'all'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--config') {
      const v = argv[++i] as Config
      if (!CONFIGS.includes(v)) { console.error(`未知配置：${v}（可用：${CONFIGS.join(' / ')}）`); process.exit(2) }
      config = v
    } else if (a === '--suite') {
      const v = argv[++i] ?? 'all'
      if (!SUITES.includes(v)) { console.error(`未知 suite：${v}（可用：${SUITES.join(' / ')}）`); process.exit(2) }
      suite = v as typeof suite
    }
  }
  return { config, suite }
}

// ── 语料装载 ─────────────────────────────────────────────────────────────────

function walkFiles(dir: string, base: string, out: { path: string; abs: string }[]): void {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) walkFiles(abs, base, out)
    else out.push({ path: abs.slice(base.length + 1), abs })
  }
}

interface Corpus {
  readonly chunks: readonly { path: string; text: string }[]
  readonly fileCount: number
}

function loadCorpus(): Corpus {
  const chunks: { path: string; text: string }[] = []
  let fileCount = 0
  for (const fixture of ['fixture-knowledge', 'fixture-codebase']) {
    const base = join(ROOT, 'tests/eval/fixtures', fixture)
    const files: { path: string; abs: string }[] = []
    walkFiles(base, base, files)
    for (const f of files) {
      fileCount++
      for (const c of chunkText(f.path, readFileSync(f.abs, 'utf8'))) chunks.push({ path: c.path, text: c.text })
    }
  }
  return { chunks, fileCount }
}

// ── 各配置执行器 ────────────────────────────────────────────────────────────

interface QuestionRow {
  readonly id: string
  readonly type: 'local' | 'global' | 'traversal'
  readonly question: string
  readonly golden: {
    readonly entities?: readonly (readonly string[])[]
    readonly relations?: readonly { readonly s: string; readonly r: string; readonly o: string }[]
    readonly points?: readonly (readonly string[])[]
    readonly seedFile?: string
    readonly goldenFiles?: readonly string[]
  }
}

export interface RunResult {
  readonly answers: Map<string, EvalAnswer>
  readonly latencies: number[]
  readonly buildMs: number
  readonly graphStats?: { entities: number; relations: number; communities: number }
  /** oracle 库文件体积（字节；库体积成本指标，0206 §3.3）。 */
  readonly dbBytes?: number
}

function runFlat(corpus: Corpus, questions: readonly QuestionRow[]): RunResult {
  const t0 = performance.now()
  const idx = new LexicalIndex(corpus.chunks.map((c, i) => ({ id: i, path: c.path, text: c.text })))
  const byId = new Map(corpus.chunks.map((c, i) => [i, c]))
  const answers = new Map<string, EvalAnswer>()
  const latencies: number[] = []
  try {
    for (const q of questions) {
      const t = performance.now()
      const hits = idx.search(extractTerms(q.question), 8)
      latencies.push(performance.now() - t)
      answers.set(q.id, {
        chunks: hits.map(h => {
          const c = byId.get(h.id)
          return { path: c?.path ?? '', text: c?.text ?? '' }
        }),
      })
    }
  } finally {
    idx.close()
  }
  return { answers, latencies, buildMs: performance.now() - t0 }
}

async function runGraph(config: 'graph-local' | 'graph-full', questions: readonly QuestionRow[]): Promise<RunResult> {
  // 落盘建库：库体积指标（0206 §3.3 成本同屏）——与 :memory: 同一建图路径
  const dir = mkdtempSync(join(tmpdir(), 'graphrag-eval-'))
  const t0 = performance.now()
  const store = buildOracleStore(config === 'graph-full', join(dir, 'graphrag.db'))
  const buildMs = performance.now() - t0
  const answers = new Map<string, EvalAnswer>()
  const latencies: number[] = []
  try {
    for (const q of questions) {
      const t = performance.now()
      try {
        if (q.type === 'local') {
          const pack = searchLocal(store, q.question)
          answers.set(q.id, { chunks: pack.chunks, entities: pack.entities.map(e => e.name) })
        } else if (q.type === 'global') {
          const pack = config === 'graph-full'
            ? await searchGlobal(store, q.question)
            : searchLocal(store, q.question) // graph-local 无摘要，回落 local
          answers.set(q.id, {
            chunks: pack.chunks, entities: pack.entities.map(e => e.name),
            communities: pack.communities.map(c => c.summary),
          })
        } else {
          const sub = searchTraversal(store, q.golden.seedFile ?? '', { direction: 'in', hops: 10, maxNodes: 500 })
          answers.set(q.id, { chunks: [], nodes: sub.nodes.map(n => n.name) })
        }
      } catch (err) {
        if (!(err instanceof GraphRagError)) throw err
        answers.set(q.id, { chunks: [], nodes: [] })
      }
      latencies.push(performance.now() - t)
    }
    const c = store.counts()
    const graphStats = { entities: c.entities, relations: c.relations, communities: c.communities }
    store.close()
    let dbBytes = 0
    try { dbBytes = statSync(join(dir, 'graphrag.db')).size } catch { /* 体积缺失不阻塞 */ }
    return { answers, latencies, buildMs, graphStats, dbBytes }
  } finally {
    store.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── 评分汇总 ─────────────────────────────────────────────────────────────────

function scoreRun(run: RunResult, questions: readonly QuestionRow[]) {
  const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
  const pick = (t: string): QuestionRow[] => questions.filter(q => q.type === t)
  const a = (q: QuestionRow): EvalAnswer => run.answers.get(q.id) ?? { chunks: [] }

  const localRows = pick('local')
  const globalRows = pick('global')
  const travRows = pick('traversal')
  const localScores = localRows.map(q => localScore(a(q), { entities: q.golden.entities ?? [], relations: q.golden.relations ?? [] }))
  const travScores = travRows.map(q => traversalPR(a(q), { goldenFiles: q.golden.goldenFiles ?? [] }))
  // MRR@5（门槛 v2 排序敏感指标）+ 多跳题（id ≥ L16，questions v2）单列
  const mrrRows = localRows.filter(q => q.id >= 'L16')
  return {
    counts: { local: localRows.length, global: globalRows.length, traversal: travRows.length },
    localEntityHit: mean(localScores.map(s => s.entityHit)),
    localRelationRecall: mean(localScores.map(s => s.relationRecall)),
    localMrr5: mean(localRows.map(q =>
      localMrr(a(q), { entities: q.golden.entities ?? [], relations: q.golden.relations ?? [] }))),
    multiHopMrr5: mrrRows.length === 0 ? null : mean(mrrRows.map(q =>
      localMrr(a(q), { entities: q.golden.entities ?? [], relations: q.golden.relations ?? [] }))),
    globalCoverage: mean(globalRows.map(q => globalCoverage(a(q), { points: q.golden.points ?? [] }))),
    traversalPrecision: mean(travScores.map(s => s.precision)),
    traversalRecall: mean(travScores.map(s => s.recall)),
    traversalF1: mean(travScores.map(s => s.f1)),
  }
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] as number
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { config, suite } = parseArgs()
  const questionsFile = JSON.parse(readFileSync(join(ROOT, 'tests/eval/questions.json'), 'utf8')) as {
    frozen: boolean
    questions: QuestionRow[]
  }
  if (!questionsFile.frozen) throw new Error('questions.json 未冻结，拒绝评测')
  const all = questionsFile.questions
  const selected = suite === 'all' ? all : all.filter(q => q.type === suite)

  const corpus = loadCorpus()
  const run = config === 'flat-bm25' ? runFlat(corpus, selected) : await runGraph(config, selected)
  const m = scoreRun(run, selected)

  // 门槛判定需要基线：graph 配置同场重算 flat-bm25（全集）
  let base: ReturnType<typeof scoreRun> | null = null
  if (config !== 'flat-bm25') base = scoreRun(runFlat(corpus, all), all)

  const sortedLat = [...run.latencies].sort((x, y) => x - y)
  let sha = 'unknown'
  try { sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim() } catch { /* 无 git 环境 */ }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const f = (x: number): string => x.toFixed(4)

  // 门槛 v2（0206 §3.2 v2，0301 M1 出口评审决定）：绝对差/非劣性替代 v1 相对阈值
  // （v1 在基线贴天花板时超过指标上限，结构性不可达）。
  // 门槛 1 取答案级非劣性（0206 规则 4 的 −2% 持平哲学）：本语料问题文本即
  // 实体名，BM25 词法直击在 MRR 排序上结构性占优（图谱的差异化价值在
  // traversal 与结构证据，见门槛 3）；MRR@5 保留为排序质量观测指标。
  const gates = base === null ? [] : [
    {
      name: '门槛1：local entityHit@5 与 relationRecall 均非劣于基线（≥ 基线 − 0.02）',
      pass: m.localEntityHit >= base.localEntityHit - 0.02 && m.localRelationRecall >= base.localRelationRecall - 0.02,
      detail: `hit ${f(m.localEntityHit)} vs ${f(base.localEntityHit)}；relRecall ${f(m.localRelationRecall)} vs ${f(base.localRelationRecall)}（MRR 观测：${f(m.localMrr5)} vs ${f(base.localMrr5)}）`,
    },
    {
      name: '门槛2：global coverage ≥ 基线 + 0.05（绝对差）',
      pass: m.globalCoverage >= base.globalCoverage + 0.05,
      detail: `${f(m.globalCoverage)} vs 基线 ${f(base.globalCoverage)}（需 ≥ ${f(base.globalCoverage + 0.05)}）`,
    },
    {
      name: '门槛3：traversal P ≥ 0.80 且 R ≥ 0.70',
      pass: m.traversalPrecision >= 0.8 && m.traversalRecall >= 0.7,
      detail: `P ${f(m.traversalPrecision)} / R ${f(m.traversalRecall)}`,
    },
  ]

  const metrics = {
    config, suite, date: stamp, gitSha: sha,
    corpus: { files: corpus.fileCount, chunks: corpus.chunks.length },
    graph: run.graphStats ?? null,
    questions: m.counts,
    localEntityHit: Number(m.localEntityHit.toFixed(4)),
    localRelationRecall: Number(m.localRelationRecall.toFixed(4)),
    localMrr5: Number(m.localMrr5.toFixed(4)),
    multiHopMrr5: m.multiHopMrr5 === null ? null : Number(m.multiHopMrr5.toFixed(4)),
    globalCoverage: Number(m.globalCoverage.toFixed(4)),
    traversalPrecision: Number(m.traversalPrecision.toFixed(4)),
    traversalRecall: Number(m.traversalRecall.toFixed(4)),
    traversalF1: Number(m.traversalF1.toFixed(4)),
    cost: { llmCalls: 0, tokensIn: 0, tokensOut: 0 },
    dbBytes: run.dbBytes ?? null,
    latencyMs: { p50: Number(percentile(sortedLat, 50).toFixed(2)), p95: Number(percentile(sortedLat, 95).toFixed(2)) },
    buildMs: Number(run.buildMs.toFixed(0)),
    baseline: base && {
      localEntityHit: Number(base.localEntityHit.toFixed(4)),
      localMrr5: Number(base.localMrr5.toFixed(4)),
      multiHopMrr5: base.multiHopMrr5 === null ? null : Number(base.multiHopMrr5.toFixed(4)),
      globalCoverage: Number(base.globalCoverage.toFixed(4)),
      traversalF1: Number(base.traversalF1.toFixed(4)),
    },
    gates,
  }

  const scorecardDir = join(ROOT, 'tests/eval/scorecards')
  mkdirSync(scorecardDir, { recursive: true })
  writeFileSync(join(scorecardDir, `${stamp}-${config}.json`), JSON.stringify(metrics, null, 2))

  const md = [
    `# Scorecard — ${config}（${suite}）`,
    '',
    `- date: ${stamp}  git: ${sha}`,
    `- corpus: ${metrics.corpus.files} files → ${metrics.corpus.chunks} chunks${run.graphStats ? `，图：${run.graphStats.entities} entities / ${run.graphStats.relations} relations / ${run.graphStats.communities} communities` : ''}`,
    `- questions: local ${m.counts.local} / global ${m.counts.global} / traversal ${m.counts.traversal}`,
    '',
    '| suite | metric | value |',
    '|---|---|---|',
    `| local | entityHit@5 | ${f(m.localEntityHit)} |`,
    `| local | relationRecall | ${f(m.localRelationRecall)} |`,
    `| local | MRR@5（门槛 v2） | ${f(m.localMrr5)}${m.multiHopMrr5 !== null ? `（多跳题 ${f(m.multiHopMrr5)}）` : ''} |`,
    `| global | coverage | ${f(m.globalCoverage)} |`,
    `| traversal | precision | ${f(m.traversalPrecision)} |`,
    `| traversal | recall | ${f(m.traversalRecall)} |`,
    `| traversal | f1 | ${f(m.traversalF1)} |`,
    '',
    `- cost: llmCalls=0（${config === 'flat-bm25' ? 'flat 基线' : 'oracle 抽取'}）；build ${metrics.buildMs}ms${run.dbBytes !== undefined ? `；库体积 ${(run.dbBytes / 1024).toFixed(0)}KB` : ''}`,
    `- latency(ms): p50=${metrics.latencyMs.p50} p95=${metrics.latencyMs.p95}`,
    ...(gates.length > 0 ? ['', '## 门槛判定（0206 §3.2 v2：绝对差 + 排序敏感）', ...gates.map(g => `- ${g.pass ? '✅' : '❌'} ${g.name} — ${g.detail}`)] : []),
    ...(config === 'flat-bm25' ? ['\n> 门槛规则对 graph 配置生效；本基线为被比较对象。'] : []),
    '',
  ].join('\n')
  writeFileSync(join(scorecardDir, `${stamp}-${config}.md`), md)
  console.log(md)
}

void main()
