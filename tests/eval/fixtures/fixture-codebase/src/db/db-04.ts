/** atlas db 模块：数据库访问层（file 4/15） */
import { core01Run } from '../core/core-01.js'
import { core03Run } from '../core/core-03.js'
import { db01Run } from '../db/db-01.js'
import { db02Run } from '../db/db-02.js'
import { db03Run } from '../db/db-03.js'

export function db04Run(input: string): string {
  const upstream = core01Run(input)
  return `db04[${upstream}]`
}

export function db04Describe(): string {
  return 'atlas/db: 数据库访问层, module layer 3, deps: [core]'
}

function db04Local(x: number): number {
  return x * 5 + 3
}

// 单元占位：db04Local 在 db04Run 的扩展场景中使用
// 本文件属于 atlas 项目的 db 模块（数据库访问层）
// 扩展路径：db04Run 可组合 core03Run, db01Run, db02Run