/** 浏览与审查视图（0207 §3.3/§3.4）：实体浏览 + 抽样审查 + 体检报告。
 * 数据经 runtime.rpc 直连主机通道；组件保持无状态拉取-渲染。
 * 证据原文是 markdown 源（md 语料）：经平台单例模块表软取宿主
 * ui-primitives 的 MarkdownText 渲染；缺席宿主回落 <pre> 原文。
 */

import { useEffect, useState } from 'react'

import { unwrap, type EntityCard, type HealthReport, type ReviewSample } from './protocol.ts'
import type { KbRuntime, Translate } from './runtime.ts'
import { RPC_CHANNEL } from './runtime.ts'

/** 平台单例模块表的 require（build.mjs 包装器注入；测试/裸环境 undefined）。 */
declare const __bundleRequire: ((spec: string) => unknown) | undefined

type MarkdownTextProps = {
  text: string
  labels: { code: { copyLabel: string; copiedLabel: string }; footnotes: string }
  variant?: 'body' | 'compact'
}

/** memo() 组件是带 $$typeof 的对象而非函数——两种形态都收。 */
type MarkdownTextFace = React.ComponentType<MarkdownTextProps>

let markdownTextCache: MarkdownTextFace | undefined | null = null

/** 软取宿主 MarkdownText（只找一次）；任何失败回落 undefined。 */
function markdownTextOf(): MarkdownTextFace | undefined {
  if (markdownTextCache !== null) return markdownTextCache
  try {
    const mod = (typeof __bundleRequire === 'function'
      ? __bundleRequire('@deepseek-ai/dsh-client-ui-primitives') as { MarkdownText?: MarkdownTextFace } | undefined
      : undefined)
    const mt = mod?.MarkdownText
    markdownTextCache = mt !== null && mt !== undefined && (typeof mt === 'function' || typeof mt === 'object')
      ? mt
      : undefined
  } catch {
    markdownTextCache = undefined
  }
  return markdownTextCache
}

/** 证据原文渲染：宿主 MarkdownText 在场即渲染 markdown（表格/加粗/标题），
 * 否则 <pre> 原文。max-height 内滚，避免长 chunk 撑爆卡片。 */
function ChunkText(props: { readonly text: string; readonly t: Translate }): React.ReactElement {
  const Markdown = markdownTextOf()
  if (Markdown === undefined) return <pre className='gv-pre'>{props.text}</pre>
  return (
    <div className='gv-pre gv-md'>
      <Markdown
        text={props.text}
        labels={{ code: { copyLabel: props.t('mdCopy'), copiedLabel: props.t('mdCopied') }, footnotes: props.t('mdFootnotes') }}
        variant='compact'
      />
    </div>
  )
}

type TabKind = 'browse' | 'review' | 'health'

export function BrowseReviewView(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [tab, setTab] = useState<TabKind>('browse')
  const tabs: { readonly kind: TabKind; readonly label: string }[] = [
    { kind: 'browse', label: t('tabBrowse') },
    { kind: 'review', label: t('tabReview') },
    { kind: 'health', label: t('tabHealth') },
  ]
  return (
    <div>
      <div className='gv-tabs'>
        {tabs.map(x => (
          <button key={x.kind} className={tab === x.kind ? 'gv-btn gv-tab-active' : 'gv-btn'} onClick={() => setTab(x.kind)}>{x.label}</button>
        ))}
      </div>
      {tab === 'browse' && <BrowseTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'review' && <ReviewTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'health' && <HealthTab runtime={runtime} t={t} kbId={kbId} />}
    </div>
  )
}

function BrowseTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<readonly EntityCard[]>([])
  const [loading, setLoading] = useState(true)

  const load = (q: string): void => {
    setLoading(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'browse', { id: kbId, query: q, limit: 30 }))
      .then((v) => setCards(v as readonly EntityCard[]))
      .catch(err => runtime.pushNotice(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load('') }, [kbId])

  return (
    <div>
      <div className='gv-search'>
        <input
          value={query}
          placeholder={t('searchPlaceholder')}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(query) }}
        />
        <button className='gv-btn' onClick={() => load(query)}>{t('search')}</button>
      </div>
      {loading && <div className='gv-empty'>{t('loading')}</div>}
      {!loading && cards.length === 0 && <div className='gv-empty'>{t('noEntities')}</div>}
      {cards.map(card => (
        <div key={card.id} className='gv-card'>
          <div className='gv-card-head'>
            <span className='gv-name'>{card.name}</span>
            <span className='gv-badge'>{card.type}</span>
            <span className='gv-badge'>deg {card.degree}</span>
          </div>
          {card.description !== null && card.description !== '' && <div>{card.description}</div>}
          {card.neighbors.length > 0 && (
            <table className='gv-table'>
              <tbody>
                {card.neighbors.map((nb, i) => (
                  <tr key={i}>
                    <td>{nb.dir === 'out' ? '→' : '←'}</td>
                    <td>{nb.type}</td>
                    <td>{nb.other}</td>
                    <td className='gv-cost'>w={nb.weight}{nb.evidence.length > 0 ? ` · ${nb.evidence[0]?.path}:${nb.evidence[0]?.lines}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}

function ReviewTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [samples, setSamples] = useState<readonly ReviewSample[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(0)
  /** 更正编辑器：非空 = 错误/存疑后展开（预填当前三元组），携带待提交判定。 */
  const [correcting, setCorrecting] = useState<{ readonly verdict: 'wrong' | 'unsure'; readonly s: string; readonly r: string; readonly o: string } | null>(null)
  const [seeding, setSeeding] = useState(false)
  /** 滑选浮标：非空 = 证据区内有非空选区（视口坐标）。 */
  const [selChip, setSelChip] = useState<{ readonly x: number; readonly y: number; readonly text: string } | null>(null)

  // 证据区内滑选 → 出现「更正」浮标；点它用所选原文向模型要三元组预填编辑器
  const onEvidenceMouseUp = (): void => {
    const sel = window.getSelection()
    const text = sel?.toString() ?? ''
    const anchor = sel?.anchorNode?.parentElement
    if (sel === null || sel.isCollapsed || text.trim().length < 2 || anchor === null || anchor.closest('.gv-md, .gv-pre') === null) {
      setSelChip(null)
      return
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    setSelChip({ x: Math.max(8, rect.left), y: rect.bottom + 6, text: text.trim().slice(0, 2000) })
  }

  const seedFromSelection = (selected: string): void => {
    setSelChip(null)
    setSeeding(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'correctFromSelection', { id: kbId, text: selected }))
      .then((v) => {
        const triples = (v as { triples?: ReadonlyArray<{ s: string; r: string; o: string }> }).triples ?? []
        const best = triples[0]
        setCorrecting(prev => ({
          verdict: prev?.verdict ?? 'wrong',
          s: best?.s ?? prev?.s ?? '',
          r: best?.r ?? prev?.r ?? '',
          o: best?.o ?? prev?.o ?? '',
        }))
        if (best === undefined) runtime.pushNotice(t('selNoTriple'))
      })
      .catch(err => runtime.pushNotice(`${t('selFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setSeeding(false))
  }

  const load = (): void => {
    setLoading(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'sampleReview', { id: kbId, limit: 20 }))
      .then((v) => { setSamples(v as readonly ReviewSample[]); setIdx(0) })
      .catch(err => runtime.pushNotice(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [kbId])

  const verdict = (v: 'correct' | 'wrong' | 'unsure', correction?: { s: string; r: string; o: string }): void => {
    const sample = samples[idx]
    if (sample === undefined) return
    const payload: Record<string, unknown> = { id: kbId, relationId: sample.id, verdict: v }
    if (correction !== undefined) {
      // 仅携带与原值不同的字段；三字段全等则退化为纯判定
      const correction2: Record<string, string> = {}
      if (correction.s.trim() !== '' && correction.s.trim() !== sample.s) correction2.s = correction.s.trim()
      if (correction.r.trim() !== '' && correction.r.trim() !== sample.r) correction2.r = correction.r.trim()
      if (correction.o.trim() !== '' && correction.o.trim() !== sample.o) correction2.o = correction.o.trim()
      if (Object.keys(correction2).length > 0) payload['correction'] = correction2
    }
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'review', payload))
      .then(() => {
        setCorrecting(null)
        setDone(n => n + 1)
        if (idx + 1 >= samples.length) load()
        else setIdx(idx + 1)
      })
      .catch(err => runtime.pushNotice(String(err)))
  }

  const current = samples[idx]
  if (loading) return <div className='gv-empty'>{t('loading')}</div>
  if (current === undefined) {
    return (
      <div className='gv-empty'>
        {t('reviewExhausted', { done })}
        <div className='gv-actions'><button className='gv-btn' onClick={load}>{t('resample')}</button></div>
      </div>
    )
  }
  return (
    <div>
      <p className='gv-sub'>{t('reviewHint', { i: idx + 1, n: samples.length, done })}</p>
      <div className='gv-card'>
        <div className='gv-card-head'>
          <span className='gv-name'>{current.s}</span>
          <span className='gv-badge'>{current.r}</span>
          <span className='gv-name'>{current.o}</span>
          <span className='gv-badge'>{t('confidence')}: {current.confidence.toFixed(2)}</span>
        </div>
        <div className='gv-sub'>{t('reviewQuestion')}</div>
        <div onMouseUp={onEvidenceMouseUp}>
          {current.evidence.map((ev, i) => (
            <div key={i} className='gv-evidence'>
              <div className='gv-cost'>{ev.path}:{ev.startLine}-{ev.endLine}</div>
              <ChunkText text={ev.text} t={t} />
            </div>
          ))}
        </div>
        <div className='gv-actions'>
          <button className='gv-btn gv-btn-primary' onClick={() => verdict('correct')}>{t('verdictCorrect')}</button>
          <button className='gv-btn gv-btn-danger' onClick={() => setCorrecting({ verdict: 'wrong', s: current.s, r: current.r, o: current.o })}>{t('verdictWrong')}</button>
          <button className='gv-btn' onClick={() => setCorrecting({ verdict: 'unsure', s: current.s, r: current.r, o: current.o })}>{t('verdictUnsure')}</button>
        </div>
        {correcting !== null && (
          <div className='gv-form' style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--gv-fg-secondary, var(--dsw-alias-label-secondary, #5a6472))' }}>
              {t('correctionTitle')}
              {seeding && <span>…</span>}
            </div>
            <label>{t('correctionS')}</label>
            <input value={correcting.s} onChange={e => setCorrecting({ ...correcting, s: e.target.value })} />
            <label>{t('correctionR')}</label>
            <input value={correcting.r} onChange={e => setCorrecting({ ...correcting, r: e.target.value })} />
            <label>{t('correctionO')}</label>
            <input value={correcting.o} onChange={e => setCorrecting({ ...correcting, o: e.target.value })} />
            <div className='gv-actions'>
              <button className='gv-btn gv-btn-primary' onClick={() => verdict(correcting.verdict, { s: correcting.s, r: correcting.r, o: correcting.o })}>{t('correctionSubmit')}</button>
              <button className='gv-btn' onClick={() => verdict(correcting.verdict)}>{correcting.verdict === 'wrong' ? t('verdictOnlyWrong') : t('verdictOnlyUnsure')}</button>
              <button className='gv-btn' onClick={() => setCorrecting(null)}>{t('cancel')}</button>
            </div>
          </div>
        )}
        {selChip !== null && (
          <button
            className='gv-btn gv-btn-primary gv-selchip'
            style={{ left: selChip.x, top: selChip.y }}
            onMouseDown={e => e.preventDefault()}
            onClick={() => seedFromSelection(selChip.text)}
          >{t('selCorrect')}</button>
        )}
      </div>
    </div>
  )
}

function HealthTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'health', { id: kbId }))
      .then(v => setReport(v as HealthReport))
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setLoading(false))
  }, [kbId])

  if (loading || report === null) return <div className='gv-empty'>{t('loading')}</div>
  const pct = (x: number | null): string => x === null ? t('never') : `${Math.round(x * 100)}%`
  return (
    <div className='gv-card'>
      <div className='gv-card-head'><span className='gv-name'>{t('healthTitle')} — {report.kbName}</span></div>
      <table className='gv-table'>
        <tbody>
          <tr><td>{t('coverage')}</td><td>{pct(report.coverage)}</td></tr>
          <tr><td>{t('filesIndexed')}</td><td>{report.files.indexed}{report.files.stale > 0 ? `（${t('stale')} ${report.files.stale}）` : ''}</td></tr>
          <tr><td>{t('quarantined')}</td><td>{report.files.quarantined}{report.quarantineRate !== null ? `（${pct(report.quarantineRate)}）` : ''}</td></tr>
          <tr><td>{t('samplePrecision')}</td><td>{report.samplePrecision === null ? t('never') : `${report.correct}/${report.sampled} = ${pct(report.samplePrecision)}`}</td></tr>
          <tr><td>{t('healthCorrected')}</td><td>{report.corrected}</td></tr>
          <tr><td>{t('excluded')}</td><td>{report.excludedRelations}</td></tr>
          <tr><td>{t('lastIndex')}</td><td>{formatAt(report.lastIndexAt)}</td></tr>
        </tbody>
      </table>
      <p className='gv-sub'>{t('healthNote')}</p>
    </div>
  )
}

function formatAt(at: number | null): string {
  if (at === null || at === 0) return '—'
  const d = new Date(at)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
