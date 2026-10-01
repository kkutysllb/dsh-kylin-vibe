/** atlas core 模块：运行时核心：配置与生命周期（file 1/15） */
import { log01Run } from '../log/log-01.js'
import { log06Run } from '../log/log-06.js'
import { log07Run } from '../log/log-07.js'
import { util01Run } from '../util/util-01.js'
import { util02Run } from '../util/util-02.js'

export function core01Run(input: string): string {
  const upstream = log01Run(input)
  return `core01[${upstream}]`
}

export function core01Describe(): string {
  return 'atlas/core: 运行时核心：配置与生命周期, module layer 2, deps: [log, util]'
}

function core01Local(x: number): number {
  return x * 2 + 2
}

// 单元占位：core01Local 在 core01Run 的扩展场景中使用
// 本文件属于 atlas 项目的 core 模块（运行时核心：配置与生命周期）
// 扩展路径：core01Run 可组合 log06Run, log07Run, util01Run