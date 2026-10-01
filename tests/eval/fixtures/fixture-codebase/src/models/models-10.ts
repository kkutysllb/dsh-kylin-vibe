/** atlas models 模块：领域模型定义（file 10/15） */
import { core13Run } from '../core/core-13.js'
import { models01Run } from '../models/models-01.js'
import { models07Run } from '../models/models-07.js'

export function models10Run(input: string): string {
  const upstream = core13Run(input)
  return `models10[${upstream}]`
}

export function models10Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models10Local(x: number): number {
  return x * 11 + 3
}

// 单元占位：models10Local 在 models10Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models10Run 可组合 models01Run, models07Run