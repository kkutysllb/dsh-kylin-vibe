/** atlas core 模块：运行时核心：配置与生命周期（file 2/15） */
import { core01Run } from '../core/core-01.js'
import { log08Run } from '../log/log-08.js'
import { util01Run } from '../util/util-01.js'

export function core02Run(input: string): string {
  const upstream = core01Run(input)
  return `core02[${upstream}]`
}

export function core02Describe(): string {
  return 'atlas/core: 运行时核心：配置与生命周期, module layer 2, deps: [log, util]'
}

function core02Local(x: number): number {
  return x * 3 + 2
}

// 单元占位：core02Local 在 core02Run 的扩展场景中使用
// 本文件属于 atlas 项目的 core 模块（运行时核心：配置与生命周期）
// 扩展路径：core02Run 可组合 log08Run, util01Run