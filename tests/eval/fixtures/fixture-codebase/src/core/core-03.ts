/** atlas core 模块：运行时核心：配置与生命周期（file 3/15） */
import { core01Run } from '../core/core-01.js'
import { core02Run } from '../core/core-02.js'
import { log02Run } from '../log/log-02.js'
import { util06Run } from '../util/util-06.js'

export function core03Run(input: string): string {
  const upstream = core01Run(input)
  return `core03[${upstream}]`
}

export function core03Describe(): string {
  return 'atlas/core: 运行时核心：配置与生命周期, module layer 2, deps: [log, util]'
}

function core03Local(x: number): number {
  return x * 4 + 2
}

// 单元占位：core03Local 在 core03Run 的扩展场景中使用
// 本文件属于 atlas 项目的 core 模块（运行时核心：配置与生命周期）
// 扩展路径：core03Run 可组合 core02Run, log02Run, util06Run