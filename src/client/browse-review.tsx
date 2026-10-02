/** 浏览与审查视图（0207 §3.3/§3.4）：实体浏览 + 抽样审查 + 体检报告。
 * 数据经 runtime.rpc 直连主机通道；组件保持无状态拉取-渲染。
 * 证据原文是 markdown 源（md 语料）：经平台单例模块表软取宿主
 * ui-primitives 的 MarkdownText 渲染；缺席宿主回落 <pre> 原文。
 */

import { useEffect, useState } from 'react'

import { unwrap, type EntityCard, type HealthReport, type ReviewSample } from './protocol.ts'
import type { KbRuntime, Translate } from './runtime.ts'
import { RPC_CHANNEL } from './runtime.ts'
import { formatTime } from './view.tsx'

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

type TabKind = 'browse' | 'review' | 'recall' | 'health' | 'manage'

export function BrowseReviewView(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string; readonly roots: readonly string[] }): React.ReactElement {
  const { runtime, t, kbId, roots } = props
  const [tab, setTab] = useState<TabKind>('browse')
  const tabs: { readonly kind: TabKind; readonly label: string }[] = [
    { kind: 'browse', label: t('tabBrowse') },
    { kind: 'review', label: t('tabReview') },
    { kind: 'recall', label: t('tabRecall') },
    { kind: 'health', label: t('tabHealth') },
    { kind: 'manage', label: t('tabManage') },
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
      {tab === 'recall' && <RecallTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'health' && <HealthTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'manage' && <ManageTab runtime={runtime} t={t} kbId={kbId} roots={roots} />}
    </div>
  )
}

/** 召回测试（Dify 同款）：输入问题 → local 检索 → 证据 chunk 带分数呈现。 */
function RecallTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [question, setQuestion] = useState('')
  const [topK, setTopK] = useState(12)
  const [pack, setPack] = useState<{ chunks: ReadonlyArray<{ path: string; lines: string; text: string; score: number | null }>; entities: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = (q: string): void => {
    if (q.trim() === '') return
    setBusy(true)
    setPack(null)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'recall', { id: kbId, question: q.trim(), topK }))
      .then((v) => {
        const pack = v as { chunks?: ReadonlyArray<{ path: string; lines: string; text: string; score: number | null }>; entities?: unknown[] }
        setPack({ chunks: pack.chunks ?? [], entities: pack.entities?.length ?? 0 })
      })
      .catch(err => runtime.pushNotice(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setBusy(false))
  }

  return (
    <div>
      <div className='gv-card'>
        <div className='gv-card-head'><span className='gv-name'>{t('recallTitle')}</span></div>
        <div className='gv-search'>
          <input
            value={question}
            placeholder={t('recallPlaceholder')}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(question) }}
          />
          <select className='gv-select' style={{ width: 90 }} value={topK} onChange={e => setTopK(Number(e.target.value))}>
            {[5, 10, 12, 20, 30, 50].map(k => <option key={k} value={k}>top {k}</option>)}
          </select>
          <button className='gv-btn gv-btn-primary' disabled={busy || question.trim() === ''} onClick={() => run(question)}>{t('recallRun')}</button>
        </div>
        <div className='gv-cost'>{t('recallHint')}</div>
      </div>
      {busy && <div className='gv-empty'>{t('loading')}</div>}
      {pack !== null && !busy && (
        <>
          <div className='gv-cost' style={{ marginBottom: 6 }}>
            {t('recallSummary', { count: pack.chunks.length, entities: pack.entities })}
          </div>
          {pack.chunks.length === 0 && <div className='gv-empty'>{t('noEntities')}</div>}
          {pack.chunks.map((c, i) => (
            <div key={i} className='gv-card'>
              <div className='gv-card-head'>
                <span className='gv-cost' style={{ wordBreak: 'break-all' }}>{c.path}:{c.lines}</span>
                {c.score !== null && <span className='gv-badge'>{t('recallScore')} {c.score.toFixed(3)}</span>}
              </div>
              <ChunkText text={c.text} t={t} />
            </div>
          ))}
        </>
      )}
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

/** 知识管理：补充新知识（粘贴文本入库）/ 来源清单（按文件删除）/ 授权目录编辑。 */
function ManageTab(props: {
  readonly runtime: KbRuntime
  readonly t: Translate
  readonly kbId: string
  readonly roots: readonly string[]
}): React.ReactElement {
  const { runtime, t, kbId, roots } = props
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('')
  const [sources, setSources] = useState<readonly KnowledgeSource[]>([])
  const [changes, setChanges] = useState<{ added: number; changed: readonly string[]; removed: readonly string[] } | null>(null)
  const [rootsText, setRootsText] = useState(roots.join('\n'))
  const [rootsSaved, setRootsSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)

  const loadSources = (): void => {
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'sources', { id: kbId }))
      .then(v => setSources(v as readonly KnowledgeSource[]))
      .catch(err => runtime.pushNotice(String(err)))
  }
  const loadChanges = (): void => {
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'changes', { id: kbId }))
      .then(v => setChanges(v as { added: number; changed: readonly string[]; removed: readonly string[] }))
      .catch(() => setChanges(null))
  }
  useEffect(() => { loadSources(); loadChanges() }, [kbId])

  const addText = (): void => {
    if (text.trim() === '') return
    setBusy(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'addText', { id: kbId, title: title.trim(), text }))
      .then(() => {
        runtime.pushNotice(t('manageNoteAdded'))
        setTitle('')
        setText('')
        loadSources()
      })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusy(false))
  }

  const runFor = (rpc: string, payload: Record<string, unknown>, notice: string): void => {
    setBusyPath(String(payload['path'] ?? ''))
    void unwrap(runtime.rpc.call(RPC_CHANNEL, rpc, { id: kbId, ...payload }))
      .then(() => { runtime.pushNotice(notice); loadSources(); loadChanges() })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusyPath(null))
  }

  const removeSource = (path: string): void => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('manageConfirmDelete'))) return
    runFor('forgetFile', { path }, t('manageFileDeleted'))
  }
  const reindexSource = (path: string): void => {
    runFor('reindexSource', { path }, t('manageReindexed'))
  }
  const toggleSource = (path: string, enabled: boolean): void => {
    runFor('setSourceEnabled', { path, enabled }, enabled ? t('manageEnabled') : t('manageDisabled'))
  }

  const importDirectory = (): void => {
    setBusy(true)
    void runtime.bridge.pickDirectory()
      .then((dir) => {
        if (dir === null) return
        return unwrap(runtime.rpc.call(RPC_CHANNEL, 'importFiles', { id: kbId, dir }))
          .then((v) => {
            const r = v as { imported: number; skipped: readonly { path: string; reason: string }[] }
            runtime.pushNotice(t('manageImported', { count: r.imported, skipped: r.skipped.length }))
            loadSources()
            loadChanges()
          })
      })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusy(false))
  }

  const saveRoots = (): void => {
    const next = rootsText.split('\n').map(l => l.trim()).filter(l => l !== '')
    setBusy(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'updateKb', { id: kbId, roots: next }))
      .then(() => { setRootsSaved(true); setTimeout(() => setRootsSaved(false), 2000) })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusy(false))
  }

  const visible = sources.filter(s => filter.trim() === '' || s.path.toLowerCase().includes(filter.trim().toLowerCase()))
  const changeTotal = changes === null ? 0 : changes.added + changes.changed.length + changes.removed.length

  return (
    <div>
      <div className='gv-card'>
        <div className='gv-card-head'><span className='gv-name'>{t('manageAddTitle')}</span></div>
        <label>{t('manageAddName')}</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('manageAddNameHint')} />
        <label>{t('manageAddText')}</label>
        <textarea value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 140 }} placeholder={t('manageAddTextHint')} />
        <div className='gv-actions'>
          <button className='gv-btn gv-btn-primary' disabled={busy || text.trim() === ''} onClick={addText}>{t('manageAddSubmit')}</button>
          <button className='gv-btn' disabled={busy} onClick={importDirectory}>{t('manageImport')}</button>
        </div>
      </div>

      <div className='gv-card'>
        <div className='gv-card-head'>
          <span className='gv-name'>{t('manageSources')}</span>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={t('manageFilterHint')}
            style={{ flex: 1, minWidth: 120 }}
          />
        </div>
        {changes !== null && changeTotal > 0 && (
          <div className='gv-notice' style={{ marginBottom: 8 }}>
            <span>{t('manageChanges', { added: changes.added, changed: changes.changed.length, removed: changes.removed.length })}</span>
            <button className='gv-btn' onClick={() => { void runtime.startIndex(kbId) }}>{t('manageSyncIndex')}</button>
          </div>
        )}
        {visible.length === 0 && <div className='gv-empty'>{sources.length === 0 ? t('manageEmpty') : t('manageNoMatch')}</div>}
        <table className='gv-table'>
          <tbody>
            {visible.map(s => (
              <tr key={s.path}>
                <td style={{ wordBreak: 'break-all' }}>
                  {s.path}
                  {s.isNote && <span className='gv-badge' style={{ marginLeft: 6 }}>{t('badgeNote')}</span>}
                  {s.state === 'disabled' && <span className='gv-badge' style={{ marginLeft: 4 }}>{t('badgeDisabled')}</span>}
                  {s.error !== null && s.error !== '' && <div className='gv-cost'>{s.error}</div>}
                </td>
                <td style={{ width: 56 }}>{s.ext !== '' ? s.ext.slice(1) : '—'}</td>
                <td style={{ width: 60 }}>{s.state}</td>
                <td style={{ width: 96 }} className='gv-cost'>{t('manageContribution', { chunks: s.stats.chunks, entities: s.stats.entities, relations: s.stats.relations })}</td>
                <td style={{ width: 84 }} className='gv-cost'>{formatTime(s.mtimeMs, t)}</td>
                <td style={{ width: 150 }}>
                  <div className='gv-actions' style={{ margin: 0, flexWrap: 'nowrap' }}>
                    <button className='gv-btn' disabled={busyPath !== null} onClick={() => reindexSource(s.path)}>{t('manageReindex')}</button>
                    {s.state === 'disabled'
                      ? <button className='gv-btn' disabled={busyPath !== null} onClick={() => toggleSource(s.path, true)}>{t('manageEnable')}</button>
                      : <button className='gv-btn' disabled={busyPath !== null} onClick={() => toggleSource(s.path, false)}>{t('manageDisable')}</button>}
                    <button className='gv-btn gv-btn-danger' disabled={busyPath !== null} onClick={() => removeSource(s.path)}>{t('manageDelete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='gv-card'>
        <div className='gv-card-head'><span className='gv-name'>{t('manageRootsTitle')}</span></div>
        <textarea value={rootsText} onChange={e => { setRootsText(e.target.value); setRootsSaved(false) }} style={{ minHeight: 60 }} />
        <div className='gv-actions'>
          <button className='gv-btn' disabled={busy} onClick={saveRoots}>{rootsSaved ? t('manageRootsSaved') : t('manageRootsSave')}</button>
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
