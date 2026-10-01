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
  readonly layout?: LayoutService
  /** 注册生命周期清理（client 侧 cordis ctx）。 */
  effect(disposer: () => unknown, label?: string): unknown
  readonly logger?: { warn(message: string): void }
}

export type { KbRuntime }
