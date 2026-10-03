/** 面板运行时：快照状态源（useSyncExternalStore）+ 动作 + 进度轮询。
 *
 * 轮询节奏：存在 running/done 未读进度时 1.2s，否则 5s——面板轻量自刷新。
 * bridge（宿主桥：目录选择/agent 代建）与 t（词典）随运行时下发，
 * ManageTab 等深层组件经 runtime.bridge 取用（不再依赖未接线的全局）。
 */

import type { HostBridge } from './bridge.ts'
import { unwrap, type ClientRpc, type CreateKbInput, type EstimateView, type KbView, type Snapshot, type UpdateKbInput } from './protocol.ts'

export const RPC_CHANNEL = '/dsh-kylin-vibe'

export type PanelPhase = 'idle' | 'loading' | 'ready' | 'error'

export interface PanelState {
  readonly phase: PanelPhase
  readonly snapshot?: Snapshot
  readonly error?: string
  readonly refreshedAt?: number
}

export interface Translate {
  (key: string, params?: Record<string, unknown>): string
}

export interface KbRuntime {
  readonly rpc: ClientRpc
  readonly bridge: HostBridge
  readonly t: Translate
  readonly source: {
    getSnapshot(): PanelState
    subscribe(listener: () => void): () => void
  }
  readonly notice: {
    getSnapshot(): string | undefined
    subscribe(listener: () => void): () => void
  }
  pushNotice(text: string): void
  dismissNotice(): void
  refresh(): Promise<void>
  start(): void
  stop(): void
  create(input: CreateKbInput): Promise<void>
  update(input: UpdateKbInput): Promise<void>
  remove(id: string): Promise<void>
  startIndex(id: string, retryQuarantined?: boolean): Promise<void>
  cancel(id: string): Promise<void>
  /** KB 级图谱遗忘（销毁性，调用方负责二次确认）。 */
  forgetGraph(id: string): Promise<void>
  /** dry-run 成本估算（索引前预估卡，0207 §3.1）。 */
  estimate(id: string): Promise<EstimateView>
}

export interface KbRuntimeDeps {
  readonly rpc: ClientRpc
  readonly bridge: HostBridge
  readonly t: Translate
}

export function createKbRuntime(deps: KbRuntimeDeps): KbRuntime {
  const { rpc, bridge, t } = deps
  let state: PanelState = { phase: 'idle' }
  const listeners = new Set<() => void>()
  const publish = (next: PanelState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }
  const source = {
    getSnapshot: (): PanelState => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }

  let noticeText: string | undefined
  const noticeListeners = new Set<() => void>()
  const pushNotice = (text: string): void => {
    noticeText = text
    for (const l of [...noticeListeners]) l()
  }

  const call = async <T>(endpoint: string, payload?: unknown): Promise<T> =>
    unwrap<T>(rpc.call(RPC_CHANNEL, endpoint, payload))

  let pollTimer: ReturnType<typeof setInterval> | undefined

  const hasRunning = (): boolean =>
    (state.snapshot?.kbs ?? []).some(kb => kb.progress !== null && kb.progress.phase !== 'done' && kb.progress.phase !== 'error')

  const tick = (): void => {
    void refresh().catch(() => { /* 轮询失败静默，下轮重试 */ })
  }

  const restartPoll = (): void => {
    if (pollTimer !== undefined) clearInterval(pollTimer)
    pollTimer = setInterval(tick, hasRunning() ? 1_200 : 5_000)
  }

  async function refresh(): Promise<void> {
    if (state.phase === 'idle' || state.phase === 'error') publish({ ...state, phase: state.phase === 'error' ? 'error' : 'loading' })
    try {
      const snapshot = await call<Snapshot>('snapshot', {})
      const runningBefore = hasRunning()
      publish({ phase: 'ready', snapshot, refreshedAt: Date.now() })
      if (hasRunning() !== runningBefore) restartPoll()
    } catch (error) {
      publish({ phase: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  const withRefresh = async (action: () => Promise<unknown>, done: string, failed: string): Promise<void> => {
    try {
      await action()
      pushNotice(done)
      await refresh()
    } catch (error) {
      pushNotice(`${failed}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const runtime: KbRuntime = {
    rpc,
    bridge,
    t,
    source,
    notice: {
      getSnapshot: (): string | undefined => noticeText,
      subscribe: (listener: () => void): (() => void) => {
        noticeListeners.add(listener)
        return () => { noticeListeners.delete(listener) }
      },
    },
    pushNotice,
    dismissNotice: (): void => { noticeText = undefined; for (const l of [...noticeListeners]) l() },
    refresh,
    start: (): void => {
      void refresh()
      restartPoll()
    },
    stop: (): void => {
      if (pollTimer !== undefined) { clearInterval(pollTimer); pollTimer = undefined }
    },
    create: (input: CreateKbInput) => withRefresh(() => call('createKb', input), t('noticeKbCreated', { name: input.name }), t('noticeKbCreateFailed')),
    update: (input: UpdateKbInput) => withRefresh(() => call('updateKb', input), t('noticeKbUpdated'), t('noticeKbUpdateFailed')),
    remove: (id: string) => withRefresh(() => call('deleteKb', { id }), t('noticeKbDeleted'), t('noticeKbDeleteFailed')),
    startIndex: (id: string, retryQuarantined = false) => withRefresh(
      () => call('index', { id, retryQuarantined }),
      retryQuarantined ? t('noticeReplayStarted') : t('noticeIndexStarted'),
      t('noticeIndexStartFailed')),
    cancel: (id: string) => withRefresh(() => call('cancel', { id }), t('noticeCancelled'), t('noticeCancelFailed')),
    forgetGraph: (id: string) => withRefresh(() => call('forgetGraph', { id }), t('noticeGraphForgotten'), t('noticeGraphForgetFailed')),
    estimate: (id: string) => call<EstimateView>('estimate', { id }),
  }
  return runtime
}

/** KB 视图排序：最后索引时间倒序，未索引在后。 */
export function sortKbs(kbs: readonly KbView[]): readonly KbView[] {
  return [...kbs].sort((a, b) => (b.lastIndexedAt ?? 0) - (a.lastIndexedAt ?? 0) || a.name.localeCompare(b.name))
}
