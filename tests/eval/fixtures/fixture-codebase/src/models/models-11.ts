/** atlas models 模块：领域模型定义（file 11/15） */
import { core01Run } from '../core/core-01.js'
import { core06Run } from '../core/core-06.js'
import { models01Run } from '../models/models-01.js'
import { models06Run } from '../models/models-06.js'
import { models08Run } from '../models/models-08.js'

export function models11Run(input: string): string {
  const upstream = core01Run(input)
  return `models11[${upstream}]`
}

export function models11Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models11Local(x: number): number {
  return x * 12 + 3
}

// 单元占位：models11Local 在 models11Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models11Run 可组合 core06Run, models01Run, models06Run