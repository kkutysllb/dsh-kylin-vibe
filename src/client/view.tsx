/** 知识库管理视图（0207 §3.1 管理页 + §3.2 进度）：KB 卡片列表 + 新建表单
 * + 每库操作（索引/取消/删除）。受控组件保持最小状态，数据经 runtime 快照。
 * 目录选择与 agent 代建经宿主桥（bridge.ts），服务缺席逐级降级。
 */

import { useEffect, useSyncExternalStore, useState } from 'react'
import { BrowseReviewView } from './browse-review.tsx'

import type { HostBridge, ModelCatalogEntry } from './bridge.ts'
import type { KbView } from './protocol.ts'
import { sortKbs, type KbRuntime, type Translate } from './runtime.ts'

export function KbManagerView(props: {
  readonly runtime: KbRuntime
  readonly t: Translate
  readonly bridge: HostBridge
}): React.ReactElement {
  const { runtime, t, bridge } = props
  const state = useSyncExternalStore(runtime.source.subscribe, runtime.source.getSnapshot)
  const notice = useSyncExternalStore(runtime.notice.subscribe, runtime.notice.getSnapshot)

  useEffect(() => { runtime.start(); return () => runtime.stop() }, [runtime])

  const [formOpen, setFormOpen] = useState(false)

  const kbs = state.snapshot ? sortKbs(state.snapshot.kbs) : []

  const delegateExplore = (): void => {
    void bridge.delegate(t('agentExplorePrompt')).then(result => {
      runtime.pushNotice(t(`delegate${result.charAt(0).toUpperCase()}${result.slice(1)}`))
      if (result !== 'none') setFormOpen(false)
    })
  }

  return (
    <div className='gv-panel'>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{t('title')}</h2>
        <button className='gv-btn' onClick={() => setFormOpen(open => !open)}>{formOpen ? t('closeForm') : t('newKb')}</button>
      </div>
      <p className='gv-sub'>{t('subtitle')}</p>

      {notice !== undefined && (
        <div className='gv-notice'>
          <span>{notice}</span>
          <button className='gv-btn' onClick={() => runtime.dismissNotice()}>{t('dismiss')}</button>
        </div>
      )}

      {state.phase === 'error' && <div className='gv-error'>{t('loadFailed')}: {state.error}</div>}
      {formOpen && <CreateForm runtime={runtime} t={t} bridge={bridge} onDone={() => setFormOpen(false)} />}

      {state.phase === 'ready' && kbs.length === 0 && !formOpen && (
        <div className='gv-empty'>
          {t('empty')}
          <div style={{ marginTop: 10 }}>
            <button className='gv-btn' onClick={delegateExplore}>{t('agentDelegateEmpty')}</button>
          </div>
        </div>
      )}

      {kbs.map(kb => <KbCard key={kb.id} kb={kb} runtime={runtime} t={t} />)}
    </div>
  )
}

function CreateForm(props: {
  readonly runtime: KbRuntime
  readonly t: Translate
  readonly bridge: HostBridge
  readonly onDone: () => void
}): React.ReactElement {
  const { runtime, t, bridge, onDone } = props
  const [name, setName] = useState('')
  const [rootsText, setRootsText] = useState('')
  const [description, setDescription] = useState('')
  const [picking, setPicking] = useState(false)
  // 代建落点：工作区 + 会话模型（'' = 跟随当前/默认）
  const [workspaceId, setWorkspaceId] = useState('')
  const [modelKey, setModelKey] = useState('')
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; title: string }>>([])
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([])

  useEffect(() => {
    setWorkspaces(bridge.listWorkspaces())
    void bridge.loadModelCatalog().then(setCatalog)
  }, [bridge])

  const rootsOf = (): string[] => rootsText.split('\n').map(line => line.trim()).filter(line => line !== '')

  const pick = (): void => {
    setPicking(true)
    void bridge.pickDirectory()
      .then(dir => {
        if (dir !== null && !rootsOf().includes(dir)) {
          setRootsText(text => text.trim() === '' ? dir : `${text.trimEnd()}\n${dir}`)
        }
      })
      .catch(() => runtime.pushNotice(t('pickUnavailable')))
      .finally(() => setPicking(false))
  }

  const submit = (): void => {
    const roots = rootsOf()
    if (name.trim() === '' || roots.length === 0) return
    void runtime.create({ name: name.trim(), roots, description: description.trim() !== '' ? description.trim() : undefined })
      .then(onDone)
  }

  const delegate = (): void => {
    const roots = rootsOf()
    if (roots.length === 0) { runtime.pushNotice(t('delegateRootsRequired')); return }
    const prompt = t('agentCreatePrompt', { name: name.trim() !== '' ? name.trim() : roots[0], roots: roots.map(r => `- ${r}`).join('\n') })
    const chosen = catalog.find(entry => `${entry.provider}|${entry.model}` === modelKey)
    void bridge.delegate(prompt, {
      workspaceId: workspaceId !== '' ? workspaceId : undefined,
      model: chosen !== undefined ? { provider: chosen.provider, model: chosen.model } : undefined,
    }).then(result => {
      runtime.pushNotice(t(`delegate${result.charAt(0).toUpperCase()}${result.slice(1)}`))
      if (result !== 'none') onDone()
    })
  }

  return (
    <div className='gv-form'>
      <label>{t('formName')}</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={t('formNameHint')} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label>{t('formWorkspace')}</label>
          <select className='gv-select' value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
            <option value=''>{t('formWorkspaceFollow')}</option>
            {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.title}</option>)}
          </select>
        </div>
        {catalog.length > 0 && (
          <div style={{ flex: '1 1 220px' }}>
            <label>{t('formModel')}</label>
            <select className='gv-select' value={modelKey} onChange={e => setModelKey(e.target.value)}>
              <option value=''>{t('formModelFollow')}</option>
              {catalog.map(entry => (
                <option key={`${entry.provider}|${entry.model}`} value={`${entry.provider}|${entry.model}`}>
                  {entry.modelName === entry.model ? `${entry.providerName} / ${entry.model}` : `${entry.modelName}`}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--gv-fg-muted, var(--dsw-alias-label-tertiary, #8a94a3))', marginTop: 4 }}>{t('formModelHint')}</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 4px' }}>
        <span style={{ fontSize: 12, color: 'var(--gv-fg-secondary, var(--dsw-alias-label-secondary, #5a6472))' }}>{t('formRoots')}</span>
        <button className='gv-btn' disabled={picking} onClick={pick}>{picking ? '…' : t('pickDir')}</button>
      </div>
      <textarea value={rootsText} onChange={e => setRootsText(e.target.value)} placeholder={t('formRootsHint')} />
      <label>{t('formDesc')}</label>
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('formDescHint')} />
      <div className='gv-actions'>
        <button className='gv-btn gv-btn-primary' disabled={name.trim() === '' || rootsText.trim() === ''} onClick={submit}>{t('create')}</button>
        <button className='gv-btn' disabled={rootsText.trim() === ''} onClick={delegate}>{t('agentDelegate')}</button>
        <button className='gv-btn' onClick={onDone}>{t('cancel')}</button>
      </div>
    </div>
  )
}

function KbCard(props: { readonly kb: KbView; readonly runtime: KbRuntime; readonly t: Translate }): React.ReactElement {
  const { kb, runtime, t } = props
  const [exploreOpen, setExploreOpen] = useState(false)
  const progress = kb.progress
  const running = progress !== null && progress.phase !== 'done' && progress.phase !== 'error'
  const pct = progress !== null && progress.filesTotal > 0
    ? Math.round((progress.filesDone / progress.filesTotal) * 100)
    : running ? 5 : 0

  const remove = (): void => {
    // eslint-disable-next-line no-alert
    if (window.confirm(t('confirmDelete', { name: kb.name }))) void runtime.remove(kb.id)
  }

  return (
    <div className='gv-card'>
      <div className='gv-card-head'>
        <span className='gv-name'>{kb.name}</span>
        {kb.managed === 'config' && <span className='gv-badge'>{t('managedByConfig')}</span>}
        {progress !== null && progress.phase === 'error' && <span className='gv-badge'>{t('phaseError')}</span>}
        {progress !== null && progress.phase === 'done' && <span className='gv-badge'>{t('phaseDone')}</span>}
      </div>
      {kb.description !== null && <div>{kb.description}</div>}
      <div className='gv-roots'>{kb.roots.join('  ·  ') || t('noRoots')}</div>
      <div className='gv-stats'>
        <span>{t('filesIndexed')}: {progress !== null && running ? `${progress.filesDone}/${progress.filesTotal}` : kb.filesIndexed}</span>
        <span>{t('entities')}: {kb.entities}</span>
        <span>{t('relations')}: {kb.relations}</span>
        <span>{t('quarantined')}: {progress?.quarantined ?? 0}</span>
        <span>{t('lastIndex')}: {formatTime(kb.lastIndexedAt, t)}</span>
      </div>
      {running && (
        <>
          <div className='gv-bar'><div className='gv-bar-fill' style={{ width: `${pct}%` }} /></div>
          <div className='gv-current'>
            {t('phaseLabel', { phase: progress?.phase ?? '' })}
            {progress?.currentFile !== null && progress?.currentFile !== undefined ? ` — ${progress.currentFile}` : ''}
            {' · '}LLM {progress?.llmCalls ?? 0}
          </div>
        </>
      )}
      {progress !== null && progress.phase === 'error' && <div className='gv-error'>{progress.error}</div>}
      {progress !== null && progress.phase === 'done' && progress.report !== null && (
        <div className='gv-cost'>{t('lastReport', {
          added: progress.report.graphDelta.entitiesAdded,
          relations: progress.report.graphDelta.relationsAdded,
          calls: progress.report.cost.llmCalls,
        })}</div>
      )}
      <div className='gv-actions'>
        <button className='gv-btn gv-btn-primary' disabled={running || kb.managed === 'config' && kb.roots.length === 0} onClick={() => void runtime.startIndex(kb.id)}>{t('index')}</button>
        {running && <button className='gv-btn gv-btn-danger' onClick={() => void runtime.cancel(kb.id)}>{t('cancelIndex')}</button>}
        <button className='gv-btn' onClick={() => setExploreOpen(open => !open)}>{exploreOpen ? t('closeExplore') : t('explore')}</button>
        {kb.managed !== 'config' && <button className='gv-btn gv-btn-danger' onClick={remove}>{t('delete')}</button>}
      </div>
      {exploreOpen && <BrowseReviewView runtime={runtime} t={t} kbId={kb.id} roots={kb.roots} />}
    </div>
  )
}

export function formatTime(at: number | null, t: Translate): string {
  if (at === null || at === 0) return t('never')
  const d = new Date(at)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
