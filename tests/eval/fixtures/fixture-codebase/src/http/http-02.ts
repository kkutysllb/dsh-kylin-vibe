/** atlas http 模块：HTTP 服务与路由（file 2/15） */
import { core01Run } from '../core/core-01.js'
import { http01Run } from '../http/http-01.js'

export function http02Run(input: string): string {
  const upstream = core01Run(input)
  return `http02[${upstream}]`
}

export function http02Describe(): string {
  return 'atlas/http: HTTP 服务与路由, module layer 3, deps: [core]'
}

function http02Local(x: number): number {
  return x * 3 + 3
}

// 单元占位：http02Local 在 http02Run 的扩展场景中使用
// 本文件属于 atlas 项目的 http 模块（HTTP 服务与路由）
// 扩展路径：http02Run 可组合 http01Run