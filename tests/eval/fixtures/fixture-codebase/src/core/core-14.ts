/** atlas core 模块：运行时核心：配置与生命周期（file 14/15） */
import { core01Run } from '../core/core-01.js'
import { core02Run } from '../core/core-02.js'
import { core13Run } from '../core/core-13.js'
import { log12Run } from '../log/log-12.js'
import { util01Run } from '../util/util-01.js'
import { util05Run } from '../util/util-05.js'

export function core14Run(input: string): string {
  const upstream = core01Run(input)
  return `core14[${upstream}]`
}

export function core14Describe(): string {
  return 'atlas/core: 运行时核心：配置与生命周期, module layer 2, deps: [log, util]'
}

function core14Local(x: number): number {
  return x * 15 + 2
}

// 单元占位：core14Local 在 core14Run 的扩展场景中使用
// 本文件属于 atlas 项目的 core 模块（运行时核心：配置与生命周期）
// 扩展路径：core14Run 可组合 core02Run, core13Run, log12Run