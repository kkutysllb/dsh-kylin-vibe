/** 浏览与审查视图（0207 §3.3/§3.4）：实体浏览 + 抽样审查 + 体检报告。
 * 数据经 runtime.rpc 直连主机通道；组件保持无状态拉取-渲染。
 */

import { useEffect, useState } from 'react'

import { unwrap, type EntityCard, type HealthReport, type ReviewSample } from './protocol.ts'
import type { KbRuntime, Translate } from './runtime.ts'
import { RPC_CHANNEL } from './runtime.ts'

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
        <button className='gv-btn' onClick={() => setTab('browse')}>{/* spacer no-op */ ''}</button>
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

  const load = (): void => {
    setLoading(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'sampleReview', { id: kbId, limit: 20 }))
      .then((v) => { setSamples(v as readonly ReviewSample[]); setIdx(0) })
      .catch(err => runtime.pushNotice(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [kbId])

  const verdict = (v: 'correct' | 'wrong' | 'unsure'): void => {
    const sample = samples[idx]
    if (sample === undefined) return
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'review', { id: kbId, relationId: sample.id, verdict: v }))
      .then(() => {
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
        {current.evidence.map((ev, i) => (
          <div key={i} className='gv-evidence'>
            <div className='gv-cost'>{ev.path}:{ev.startLine}-{ev.endLine}</div>
            <pre className='gv-pre'>{ev.text}</pre>
          </div>
        ))}
        <div className='gv-actions'>
          <button className='gv-btn gv-btn-primary' onClick={() => verdict('correct')}>{t('verdictCorrect')}</button>
          <button className='gv-btn gv-btn-danger' onClick={() => verdict('wrong')}>{t('verdictWrong')}</button>
          <button className='gv-btn' onClick={() => verdict('unsure')}>{t('verdictUnsure')}</button>
        </div>
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
