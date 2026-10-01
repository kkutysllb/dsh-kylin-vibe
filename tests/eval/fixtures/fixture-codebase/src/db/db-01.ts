/** atlas db 模块：数据库访问层（file 1/15） */
import { core01Run } from '../core/core-01.js'
import { core06Run } from '../core/core-06.js'
import { core08Run } from '../core/core-08.js'
import { core10Run } from '../core/core-10.js'

export function db01Run(input: string): string {
  const upstream = core01Run(input)
  return `db01[${upstream}]`
}

export function db01Describe(): string {
  return 'atlas/db: 数据库访问层, module layer 3, deps: [core]'
}

function db01Local(x: number): number {
  return x * 2 + 3
}

// 单元占位：db01Local 在 db01Run 的扩展场景中使用
// 本文件属于 atlas 项目的 db 模块（数据库访问层）
// 扩展路径：db01Run 可组合 core06Run, core08Run, core10Run