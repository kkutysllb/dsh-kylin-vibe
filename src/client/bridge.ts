/** 宿主桥：目录选择链 + agent 代建（把自包含提示词写进会话并提交）。
 *
 * 两个机制均为 automation / super-ppts 同款软探测——服务缺席逐级降级，绝不
 * 假装成功：
 * - 目录选择：桌面桥全局（qilin:// 窗口）→ uiWorkspace.pickDirectory（宿主
 *   OS 选择器）→ 抛错（表单内联展示，点击无反应才是 bug）。
 * - 会话投递：当前会话 setDraft+submit（顺序不可颠倒）→ 无落点时
 *   sessions.create()+open → submit 不存在或任一步抛错 → 剪贴板降级，
 *   返回 'copied'/'none'，绝不返回假 'submitted'。
 */

export type DelegateResult = 'submitted' | 'copied' | 'none'

/** 宿主输入壳（sessions.scope(id).conversation.input.for(actx)）。 */
interface InputShell {
  setDraft?(text: string): void
  submit?(mode?: unknown): void
}

/** 客户端 sessions 服务面（@deepseek-ai/dsh-api-session-controller 注入）。 */
export interface SessionsFace {
  readonly list?: { getSnapshot?(): { current?: string } }
  create?(opts?: { cwd?: string }): Promise<string>
  open?(id: string): void
  retainAgentScope?(this: SessionsFace, id: string): { release?(): void }
  scope?(id: string): (Record<string, unknown> & {
    conversation?: { input?: { for?(carrier: unknown): InputShell } }
  }) | undefined
}

/** ui-workspace 客户端服务面（@deepseek-ai/dsh-client-ui-workspace 注入）。 */
export interface UiWorkspaceFace {
  pickDirectory?(): Promise<string | null>
  openSession?(target: string): void
  openWorkspace?(target: string): unknown
}

interface BridgeCtx {
  readonly sessions?: SessionsFace
  readonly uiWorkspace?: UiWorkspaceFace
  readonly layout?: { selectPanel?(panelKey: string | null): void }
}

export interface HostBridge {
  /** 目录选择链；全部缺席时 reject（调用方内联展示错误）。 */
  pickDirectory(): Promise<string | null>
  /** 把提示词投递给会话（当前会话优先，必要时新建），成功后回到会话视图。 */
  delegate(prompt: string): Promise<DelegateResult>
}

export function createHostBridge(ctx: BridgeCtx): HostBridge {
  const backToChat = (): void => {
    try { ctx.layout?.selectPanel?.(null) } catch { /* 服务不可达：留在当前面板 */ }
  }

  const clipboardFallback = async (text: string): Promise<DelegateResult> => {
    let copied = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText !== undefined) {
        copied = await navigator.clipboard.writeText(text).then(() => true).catch(() => false)
      }
    } catch { /* 剪贴板不可用 */ }
    if (!copied) return 'none'
    try {
      const current = ctx.sessions?.list?.getSnapshot?.().current
      if (current === undefined && typeof ctx.sessions?.create === 'function') {
        await ctx.sessions.create().then(id => { try { ctx.sessions?.open?.(id) } catch { /* 已选中 */ } }).catch(() => { /* 无落点 */ })
      }
    } catch { /* 服务不可达 */ }
    backToChat()
    return 'copied'
  }

  return {
    async pickDirectory(): Promise<string | null> {
      const global = globalThis as { __QILIN_DIRECTORY_PICKER__?: { pick: () => Promise<string | null> } }
      if (typeof global.__QILIN_DIRECTORY_PICKER__?.pick === 'function') {
        try {
          const picked = await global.__QILIN_DIRECTORY_PICKER__.pick()
          // 桌面桥在场：null/空串表示用户取消。
          return picked !== null && picked !== '' ? picked : null
        } catch (error) {
          if (ctx.uiWorkspace?.pickDirectory === undefined) throw error
          // 桌面桥坏了——落到宿主选择器。
        }
      }
      if (ctx.uiWorkspace?.pickDirectory !== undefined) {
        return await ctx.uiWorkspace.pickDirectory()
      }
      throw new Error('picker-unavailable')
    },

    async delegate(prompt: string): Promise<DelegateResult> {
      try {
        const sessions = ctx.sessions
        if (sessions?.list?.getSnapshot === undefined) return await clipboardFallback(prompt)
        const sessionId = sessions.list.getSnapshot().current
        if (sessionId === undefined || sessionId === null) {
          if (typeof sessions.create !== 'function') return await clipboardFallback(prompt)
          const created = await sessions.create().catch(() => undefined)
          if (created === undefined) return await clipboardFallback(prompt)
          try { sessions.open?.(created) } catch { /* 已选中 */ }
          backToChat()
          const landed = submitRetained(sessions, created, prompt)
            ?? await submitWithRetry(sessions, created, prompt)
          if (landed === true) return 'submitted'
          return await clipboardFallback(prompt)
        }
        backToChat()
        const landed = submitRetained(sessions, sessionId, prompt)
          ?? await submitWithRetry(sessions, sessionId, prompt)
        if (landed === true) return 'submitted'
        return await clipboardFallback(prompt)
      } catch {
        return await clipboardFallback(prompt)
      }
    },
  }
}

/** 写草稿并提交；返回 undefined = 输入面不可达（降级），false = submit 缺席。
 * conversation 服务经 `actx.get('conversation')` 解析（宿主 ui-conversation
 * 自己的路径）——cordis 4 作用域上**属性访问未 inject 会抛错**（0.2.0 实测，
 * 与宿主侧 reflect 契约同源），绝不能 `actx.conversation`。 */
function submitTo(sessions: SessionsFace, sessionId: string, text: string): boolean | undefined {
  try {
    const actx = sessions.scope?.(sessionId) as (Record<string, unknown> & {
      get?(name: string): unknown
    }) | undefined
    if (actx === undefined) return undefined
    const conversation = (typeof actx.get === 'function' ? actx.get('conversation') : undefined) as {
      input?: { for?(carrier: unknown): InputShell }
    } | undefined
    const shell = conversation?.input?.for?.(actx)
    if (shell?.setDraft === undefined) return undefined
    shell.setDraft(text)
    if (typeof shell.submit !== 'function') return false
    shell.submit()
    return true
  } catch {
    return undefined
  }
}

/** 投递首选路径：retainAgentScope 同步物化作用域（scope() 只读不建——面板
 * 场景会话视图未 retain 时 scope() 恒 undefined），提交完即释放引用。
 * 返回 undefined = 服务缺席（走重试/降级），false = submit 缺席（旧宿主）。
 */
function submitRetained(sessions: SessionsFace, sessionId: string, text: string): boolean | undefined {
  if (typeof sessions.retainAgentScope !== 'function') return undefined
  const reference = sessions.retainAgentScope.call(sessions, sessionId)
  try {
    return submitTo(sessions, sessionId, text)
  } finally {
    try { reference?.release?.() } catch { /* 引用释放失败不影响投递结果 */ }
  }
}

/** scope() 只返回已被会话视图 retain 的作用域——面板切回会话后视图异步挂载，
 * 有界重试桥接这段窗口（无 retainAgentScope 的宿主路径）；submit 缺席（false）
 * 不重试。 */
async function submitWithRetry(sessions: SessionsFace, sessionId: string, text: string): Promise<boolean | undefined> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const landed = await submitTo(sessions, sessionId, text)
    if (landed !== undefined) return landed
    await new Promise(resolve => { setTimeout(resolve, 250) })
  }
  return undefined
}
