/** atlas core 模块：运行时核心：配置与生命周期（file 4/15） */
import { core01Run } from '../core/core-01.js'
import { core02Run } from '../core/core-02.js'
import { log09Run } from '../log/log-09.js'
import { log13Run } from '../log/log-13.js'
import { util01Run } from '../util/util-01.js'
import { util04Run } from '../util/util-04.js'
import { util12Run } from '../util/util-12.js'

export function core04Run(input: string): string {
  const upstream = core01Run(input)
  return `core04[${upstream}]`
}

export function core04Describe(): string {
  return 'atlas/core: 运行时核心：配置与生命周期, module layer 2, deps: [log, util]'
}

function core04Local(x: number): number {
  return x * 5 + 2
}

// 单元占位：core04Local 在 core04Run 的扩展场景中使用
// 本文件属于 atlas 项目的 core 模块（运行时核心：配置与生命周期）
// 扩展路径：core04Run 可组合 core02Run, log09Run, log13Run