/** atlas http 模块：HTTP 服务与路由（file 1/15） */
import { core01Run } from '../core/core-01.js'
import { core05Run } from '../core/core-05.js'
import { core09Run } from '../core/core-09.js'

export function http01Run(input: string): string {
  const upstream = core01Run(input)
  return `http01[${upstream}]`
}

export function http01Describe(): string {
  return 'atlas/http: HTTP 服务与路由, module layer 3, deps: [core]'
}

function http01Local(x: number): number {
  return x * 2 + 3
}

// 单元占位：http01Local 在 http01Run 的扩展场景中使用
// 本文件属于 atlas 项目的 http 模块（HTTP 服务与路由）
// 扩展路径：http01Run 可组合 core05Run, core09Run