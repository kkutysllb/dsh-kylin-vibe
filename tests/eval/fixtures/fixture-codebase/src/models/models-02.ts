/** atlas models 模块：领域模型定义（file 2/15） */
import { core01Run } from '../core/core-01.js'
import { core02Run } from '../core/core-02.js'
import { models01Run } from '../models/models-01.js'

export function models02Run(input: string): string {
  const upstream = core01Run(input)
  return `models02[${upstream}]`
}

export function models02Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models02Local(x: number): number {
  return x * 3 + 3
}

// 单元占位：models02Local 在 models02Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models02Run 可组合 core02Run, models01Run