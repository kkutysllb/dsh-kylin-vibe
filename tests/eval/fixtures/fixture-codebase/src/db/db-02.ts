/** atlas db 模块：数据库访问层（file 2/15） */
import { core01Run } from '../core/core-01.js'
import { db01Run } from '../db/db-01.js'

export function db02Run(input: string): string {
  const upstream = core01Run(input)
  return `db02[${upstream}]`
}

export function db02Describe(): string {
  return 'atlas/db: 数据库访问层, module layer 3, deps: [core]'
}

function db02Local(x: number): number {
  return x * 3 + 3
}

// 单元占位：db02Local 在 db02Run 的扩展场景中使用
// 本文件属于 atlas 项目的 db 模块（数据库访问层）
// 扩展路径：db02Run 可组合 db01Run