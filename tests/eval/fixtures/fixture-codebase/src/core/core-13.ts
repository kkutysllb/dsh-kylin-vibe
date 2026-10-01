/** atlas core 模块：运行时核心：配置与生命周期（file 13/15） */
import { core01Run } from '../core/core-01.js'
import { core04Run } from '../core/core-04.js'
import { core07Run } from '../core/core-07.js'
import { log04Run } from '../log/log-04.js'
import { log07Run } from '../log/log-07.js'
import { util01Run } from '../util/util-01.js'

export function core13Run(input: string): string {
  const upstream = core01Run(input)
  return `core13[${upstream}]`
}

export function core13Describe(): string {
  return 'atlas/core: 运行时核心：配置与生命周期, module layer 2, deps: [log, util]'
}

function core13Local(x: number): number {
  return x * 14 + 2
}

// 单元占位：core13Local 在 core13Run 的扩展场景中使用
// 本文件属于 atlas 项目的 core 模块（运行时核心：配置与生命周期）
// 扩展路径：core13Run 可组合 core04Run, core07Run, log04Run