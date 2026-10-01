/** atlas models 模块：领域模型定义（file 13/15） */
import { core08Run } from '../core/core-08.js'
import { models01Run } from '../models/models-01.js'
import { models09Run } from '../models/models-09.js'

export function models13Run(input: string): string {
  const upstream = core08Run(input)
  return `models13[${upstream}]`
}

export function models13Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models13Local(x: number): number {
  return x * 14 + 3
}

// 单元占位：models13Local 在 models13Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models13Run 可组合 models01Run, models09Run