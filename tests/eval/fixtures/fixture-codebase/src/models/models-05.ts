/** atlas models 模块：领域模型定义（file 5/15） */
import { core01Run } from '../core/core-01.js'
import { core04Run } from '../core/core-04.js'
import { core05Run } from '../core/core-05.js'
import { models01Run } from '../models/models-01.js'
import { models02Run } from '../models/models-02.js'

export function models05Run(input: string): string {
  const upstream = core01Run(input)
  return `models05[${upstream}]`
}

export function models05Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models05Local(x: number): number {
  return x * 6 + 3
}

// 单元占位：models05Local 在 models05Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models05Run 可组合 core04Run, core05Run, models01Run