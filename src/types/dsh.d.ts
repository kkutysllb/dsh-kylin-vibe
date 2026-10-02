/** 宿主能力最小类型垫片（docs/02-design/0103 §3.2 / 0205 §1）。
 *
 * 纪律：零 `@deepseek-ai/*` 运行时导入——宿主能力经 inject 服务名注入，
 * 本文件只提供编译期声明（全局环境声明，非模块augmentation），让插件
 * 无需 workspace link 宿主 checkout 即可 typecheck + build。只声明本插件
 * 触碰的面，形状从宿主源码核实（packages/llm，2026-10-02 时点）。
 *
 * llm 契约按鸭子型窄面声明：消费方（adapter.ts 的 llmCompleterOf）
 * 对 chunk 形状做防御性读取（text 增量 / 终止 failure），不假设精确字段。
 * graphrag 服务面用结构宽松类型（本插件代码从 '../index.ts' 导入精确类型，
 * 此处只为宿主 ctx 提供最小形状）。
 */

declare module '@deepseek-ai/cordis' {
  /** 辅助调用请求：request-only 用户输入（非会话记录，0203 §1.5 纪律）。
   * image 块：宿主 pi-ai/deepseek 路线原生视觉输入（attachment 为持久
   * ImageAttachmentRef，0.2.0 实测 llm-pi-ai/src/adapter.ts 内容装配）。 */
  interface GraphRagLlmMessage {
    readonly role: 'system' | 'user' | 'assistant'
    readonly content: readonly (
      | string
      | { readonly type: 'text'; readonly text: string }
      | { readonly type: 'image'; readonly attachment: unknown }
    )[]
  }

  interface GraphRagLlmStreamOptions {
    readonly provider: string
    readonly model: string
    readonly messages: readonly GraphRagLlmMessage[]
    readonly maxTokens?: number
    readonly signal?: AbortSignal
  }

  /** 流 chunk 的防御性鸭子型：文本增量或终止结果。 */
  interface GraphRagLlmChunk {
    readonly type?: string
    readonly kind?: string
    readonly text?: string
    readonly failure?: { readonly code?: string; readonly message?: string }
  }

  interface GraphRagLlmLike {
    stream(options: GraphRagLlmStreamOptions): AsyncIterable<GraphRagLlmChunk>
    listProviders?(): readonly string[]
  }

  interface Context {
    /** provider-neutral 模型调用服务（宿主注入；缺席时降级）。 */
    readonly llm?: GraphRagLlmLike
    /** 本插件的 seam 服务（src/index.ts 经 reflect.provide 注册）。 */
    readonly graphrag?: { register(p: unknown): () => void; resolve(pin?: string): unknown }
    /** cordis 反射层：provide 注册 / get 非严格读取（0.2.0 实测，属性直赋
     * 与未 inject 的属性访问都会抛错）。 */
    readonly reflect?: {
      provide(name: string, value?: unknown): () => void
      get(name: string, strict?: boolean): unknown
    }
    /** effect：注册卸载清理（Cordis 生命周期；可带调试标签）。 */
    effect(disposer: () => unknown, label?: string): unknown
    /** 事件订阅（agent/created、tools/pre-execute 等）；返回注销函数。 */
    on(event: string, cb: (payload: unknown, next?: () => Promise<unknown>) => unknown): () => void
    readonly logger?: { warn(msg: string): void }
    /** 工具注册服务（宿主注入）。 */
    readonly tools?: { register(def: unknown): () => void }
    /** 系统提示词分段注入（宿主注入）。 */
    readonly systemPrompt?: { section(s: { readonly name: string; readonly order: number; readonly text: string }): () => void }
    /** agent 注册表（宿主注入）。 */
    readonly agents?: {
      roots(): readonly unknown[]
      on(event: string, cb: (payload: unknown) => void): () => void
    }
  }
}
