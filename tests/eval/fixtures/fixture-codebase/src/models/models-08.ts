/** atlas models 模块：领域模型定义（file 8/15） */
import { core01Run } from '../core/core-01.js'
import { core12Run } from '../core/core-12.js'
import { models01Run } from '../models/models-01.js'
import { models02Run } from '../models/models-02.js'
import { models04Run } from '../models/models-04.js'

export function models08Run(input: string): string {
  const upstream = core01Run(input)
  return `models08[${upstream}]`
}

export function models08Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models08Local(x: number): number {
  return x * 9 + 3
}

// 单元占位：models08Local 在 models08Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models08Run 可组合 core12Run, models01Run, models02Run