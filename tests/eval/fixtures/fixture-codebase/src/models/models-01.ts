/** atlas models 模块：领域模型定义（file 1/15） */
import { core01Run } from '../core/core-01.js'
import { core05Run } from '../core/core-05.js'
import { core09Run } from '../core/core-09.js'

export function models01Run(input: string): string {
  const upstream = core01Run(input)
  return `models01[${upstream}]`
}

export function models01Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models01Local(x: number): number {
  return x * 2 + 3
}

// 单元占位：models01Local 在 models01Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models01Run 可组合 core05Run, core09Run