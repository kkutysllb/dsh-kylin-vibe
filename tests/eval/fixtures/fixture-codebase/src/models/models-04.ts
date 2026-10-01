/** atlas models 模块：领域模型定义（file 4/15） */
import { core01Run } from '../core/core-01.js'
import { core12Run } from '../core/core-12.js'
import { models01Run } from '../models/models-01.js'
import { models03Run } from '../models/models-03.js'

export function models04Run(input: string): string {
  const upstream = core01Run(input)
  return `models04[${upstream}]`
}

export function models04Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models04Local(x: number): number {
  return x * 5 + 3
}

// 单元占位：models04Local 在 models04Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models04Run 可组合 core12Run, models01Run, models03Run