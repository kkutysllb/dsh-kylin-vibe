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

export type DelegateResult = 'submitted' | 'draft' | 'copied' | 'none'

/** 宿主输入壳（sessions.scope(id).conversation.input.for(actx)）。 */
interface InputShell {
  setDraft?(text: string): void
  submit?(mode?: unknown): void
}

/** 客户端 sessions 服务面（@deepseek-ai/dsh-api-session-controller 注入）。 */
export interface SessionsFace {
  readonly list?: { getSnapshot?(): { current?: string } }
  create?(opts?: { cwd?: string; workspaceId?: string }): Promise<string>
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

/** 工作区服务面（@deepseek-ai/dsh-api-workspace-controller 注入）。 */
export interface WorkspacesFace {
  readonly list?: {
    getSnapshot?(): {
      readonly items?: ReadonlyArray<{
        readonly workspaceId: string
        readonly title?: string
        readonly sessionIds?: readonly string[]
      }>
    }
  }
}

/** 远端命名空间面（@deepseek-ai/dsh-api-remotes + 'remote.session'）。 */
export interface RemoteFace {
  readonly session?: {
    modelCatalog?(): Promise<{ ok?: unknown; value?: unknown; error?: { code?: unknown; message?: unknown } }>
  }
}

/** 单会话模型目录面（@deepseek-ai/dsh-client-ui-model-selection 的
 * modelDirectories 服务；select 为 durable 会话级选择，与输入框选择器同源）。 */
export interface ModelDirectoriesFace {
  directoryFor?(sessionId: string): {
    readonly store?: {
      getSnapshot?(): {
        readonly current?: { provider: string; model: string } | null
      }
    }
    select?(selection: { provider: string; model: string }): Promise<unknown>
  }
}

interface BridgeCtx {
  readonly sessions?: SessionsFace
  readonly uiWorkspace?: UiWorkspaceFace
  readonly workspaces?: WorkspacesFace
  readonly remote?: RemoteFace
  readonly modelDirectories?: ModelDirectoriesFace
  readonly layout?: { selectPanel?(panelKey: string | null): void }
}

/** 代建选项：目标工作区（缺省跟随当前会话所在工作区）+ 会话模型（缺省不改）。 */
export interface DelegateOptions {
  readonly workspaceId?: string
  readonly model?: { readonly provider: string; readonly model: string }
}

/** 模型目录项（表单下拉用；归一化自 remote.session.modelCatalog）。 */
export interface ModelCatalogEntry {
  readonly provider: string
  readonly providerName: string
  readonly model: string
  readonly modelName: string
}

export interface HostBridge {
  /** 目录选择链；全部缺席时 reject（调用方内联展示错误）。 */
  pickDirectory(): Promise<string | null>
  /** 工作区清单（id + 展示名）；服务缺席返回空数组。 */
  listWorkspaces(): Array<{ id: string; title: string }>
  /** 模型目录（扁平 provider/model 项）；服务缺席或失败返回空数组。 */
  loadModelCatalog(): Promise<ModelCatalogEntry[]>
  /** 把提示词投递给会话（可指定落点工作区与会话模型），成功后回到会话视图。 */
  delegate(prompt: string, options?: DelegateOptions): Promise<DelegateResult>
}

export function createHostBridge(ctx: BridgeCtx): HostBridge {
  const backToChat = (): void => {
    try { ctx.layout?.selectPanel?.(null) } catch { /* 服务不可达：留在当前面板 */ }
  }

  /** 会话视图导航：uiWorkspace.openSession（宿主架构正路）→ sessions.open
   * （旧形态兜底）→ 都缺席时留在当前视图（会话仍在侧边栏可见）。 */
  const navigateToSession = (target: string): void => {
    const nav = ctx.uiWorkspace?.openSession
    if (typeof nav === 'function') {
      try { nav.call(ctx.uiWorkspace, target); return } catch { /* 落兜底 */ }
    }
    try { ctx.sessions?.open?.(target) } catch { /* 视图维持现状 */ }
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
        await ctx.sessions.create().then(id => { navigateToSession(id) }).catch(() => { /* 无落点 */ })
      } else if (current !== undefined) {
        navigateToSession(current)
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

    listWorkspaces(): Array<{ id: string; title: string }> {
      try {
        const items = ctx.workspaces?.list?.getSnapshot?.().items ?? []
        return items.map(item => ({ id: item.workspaceId, title: item.title ?? item.workspaceId }))
      } catch {
        return []
      }
    },

    async loadModelCatalog(): Promise<ModelCatalogEntry[]> {
      try {
        const catalog = ctx.remote?.session?.modelCatalog
        if (typeof catalog !== 'function') return []
        const response = (await catalog.call(ctx.remote!.session)) as {
          ok?: unknown; value?: unknown; error?: { code?: unknown; message?: unknown }
        }
        if (response?.ok !== true) return []
        const out: ModelCatalogEntry[] = []
        const groups = (response.value as { groups?: unknown }).groups
        if (!Array.isArray(groups)) return []
        for (const group of groups as Array<Record<string, unknown>>) {
          const provider = typeof group['id'] === 'string' ? group['id'] : undefined
          const providerName = typeof group['name'] === 'string' ? group['name'] : provider
          const models = Array.isArray(group['models']) ? group['models'] : []
          if (provider === undefined || providerName === undefined) continue
          for (const model of models as Array<Record<string, unknown>>) {
            const id = typeof model['id'] === 'string' ? model['id'] : undefined
            const name = typeof model['name'] === 'string' ? model['name'] : id
            if (id === undefined || name === undefined) continue
            out.push({ provider, providerName, model: id, modelName: name })
          }
        }
        return out
      } catch {
        return []
      }
    },

    async delegate(prompt: string, options: DelegateOptions = {}): Promise<DelegateResult> {
      try {
        const sessions = ctx.sessions
        if (sessions?.list?.getSnapshot === undefined) return await clipboardFallback(prompt)
        let target = sessions.list.getSnapshot().current ?? null
        const wantedWorkspace = options.workspaceId
        if (wantedWorkspace !== undefined) {
          // 目标工作区与当前会话不一致时，在工作区内新建会话承接代建。
          const current = target
          const currentWorkspace = current !== null
            ? (ctx.workspaces?.list?.getSnapshot?.().items ?? [])
              .find(item => item.sessionIds?.includes(current) === true)?.workspaceId
            : undefined
          if (currentWorkspace !== wantedWorkspace) {
            if (typeof sessions.create !== 'function') return await clipboardFallback(prompt)
            target = await sessions.create({ workspaceId: wantedWorkspace }).catch(() => null)
            if (target === null) return await clipboardFallback(prompt)
          }
        }
        if (target === null) {
          if (typeof sessions.create !== 'function') return await clipboardFallback(prompt)
          target = await sessions.create().catch(() => null)
          if (target === null) return await clipboardFallback(prompt)
        }
        backToChat()
        // 视图导航归 ui-workspace 所有（sessions 服务没有 open——0.2.0-rc.2
        // 实测缺失）；不导航用户就停在空白会话，看不到已投递的提示词。
        navigateToSession(target)
        // 会话模型：durable 选择（与输入框选择器同源）；失败不阻断投递。
        if (options.model !== undefined) {
          const directory = ctx.modelDirectories?.directoryFor?.(target)
          if (directory?.select !== undefined) {
            await directory.select(options.model).catch(() => { /* 模型切换失败：用会话默认模型投递 */ })
          }
        }
        const landed = submitRetained(sessions, target, prompt)
          ?? await submitWithRetry(sessions, target, prompt)
        // true=已发送；false=输入面可达但 submit 缺席（草稿已写入，用户手动发送）
        if (landed === true) return 'submitted'
        if (landed === false) return 'draft'
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
