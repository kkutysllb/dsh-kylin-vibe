/** atlas models 模块：领域模型定义（file 9/15） */
import { core05Run } from '../core/core-05.js'
import { models01Run } from '../models/models-01.js'
import { models03Run } from '../models/models-03.js'
import { models04Run } from '../models/models-04.js'

export function models09Run(input: string): string {
  const upstream = core05Run(input)
  return `models09[${upstream}]`
}

export function models09Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models09Local(x: number): number {
  return x * 10 + 3
}

// 单元占位：models09Local 在 models09Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models09Run 可组合 models01Run, models03Run, models04Run