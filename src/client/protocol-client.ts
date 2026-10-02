/** 客户端宿主上下文的最小类型面（自包含，无宿主模块导入——与 protocol.ts
 * 同纪律）。slots/connection/layout 由 client inject 服务在运行时提供。
 */

import type { KbRuntime } from './runtime.ts'

export interface SlotRegistration {
  readonly name: string
  readonly id?: string
  readonly key?: string
  readonly order?: number
  /** 活函数：宿主按当前语言求值（语言切换后侧边栏标签即时跟随）。 */
  readonly label?: string | (() => string)
  /** 词条命名空间：声明该槽位文本归属，宿主语言切换时重渲染。 */
  readonly locale?: string
}

export interface SlotsService {
  inject?(slot: string, factory: () => () => void): void
  register(registration: SlotRegistration, component: unknown): () => void
}

/** 宿主 locale 服务（`@deepseek-ai/dsh-client-locale` 注入）。register 落词典，
 * bind 返回活翻译器——引擎语言切换后返回值自动跟随，无需重建面板。
 */
export interface LocaleService {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
  bind(namespace: string): (key: string, params?: Record<string, unknown>) => string
}

/** 宿主输入壳（sessions.scope(id).conversation.input.for(actx)）：
 * setDraft 写草稿 → submit 提交（顺序不可颠倒）。
 */
export interface InputShell {
  setDraft?(text: string): void
  submit?(mode?: unknown): void
}

/** 会话服务面（`@deepseek-ai/dsh-api-session-controller` 注入；软探测）。
 * retainAgentScope 同步物化会话作用域（scope() 只读不建），返回引用用完
 * release()，引用计数归零后作用域退出。
 */
export interface SessionsService {
  readonly list?: { getSnapshot?(): { current?: string } }
  create?(opts?: { cwd?: string }): Promise<string>
  open?(id: string): void
  retainAgentScope?(id: string): { release?(): void }
  scope?(id: string): (Record<string, unknown> & {
    conversation?: { input?: { for?(carrier: unknown): InputShell } }
  }) | undefined
}

/** ui-workspace 客户端服务（`@deepseek-ai/dsh-client-ui-workspace` 注入）：
 * 宿主 OS 目录选择器 + 会话/工作区导航（软探测）。
 */
export interface UiWorkspaceService {
  pickDirectory?(): Promise<string | null>
  openSession?(target: string): void
  openWorkspace?(target: string): unknown
}

export interface ConnectionService {
  rpc?: {
    call(channel: string, endpoint: string, payload: unknown): Promise<unknown>
  }
}

export interface LayoutService {
  selectPanel?(panelKey: string | null): void
}

export interface ClientContext {
  readonly slots?: SlotsService
  readonly connection?: ConnectionService
  readonly locale?: LocaleService
  readonly sessions?: SessionsService
  readonly uiWorkspace?: UiWorkspaceService
  readonly layout?: LayoutService
  /** 注册生命周期清理（client 侧 cordis ctx）。 */
  effect(disposer: () => unknown, label?: string): unknown
  readonly logger?: { warn(message: string): void }
}

export type { KbRuntime }
