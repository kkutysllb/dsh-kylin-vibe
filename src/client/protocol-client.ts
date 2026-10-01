/** 客户端宿主上下文的最小类型面（自包含，无宿主模块导入——与 protocol.ts
 * 同纪律）。slots/connection/layout 由 client inject 服务在运行时提供。
 */

import type { KbRuntime } from './runtime.ts'

export interface SlotRegistration {
  readonly name: string
  readonly id?: string
  readonly key?: string
  readonly order?: number
  readonly label?: string
}

export interface SlotsService {
  inject?(slot: string, factory: () => () => void): void
  register(registration: SlotRegistration, component: unknown): () => void
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
  readonly layout?: LayoutService
  /** 注册生命周期清理（client 侧 cordis ctx）。 */
  effect(disposer: () => unknown, label?: string): unknown
  readonly logger?: { warn(message: string): void }
}

export type { KbRuntime }
