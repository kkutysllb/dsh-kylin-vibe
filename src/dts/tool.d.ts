/** 宿主装载入口（cordis.patch.yml 行 / client 模块表）。配置为普通对象，
 * 字段防御钳制在运行时完成（见 src/tool.ts 源注释）。 */
export declare const name: string
export declare const inject: readonly string[]
export declare function apply(ctx: unknown, config?: Record<string, unknown>): void
