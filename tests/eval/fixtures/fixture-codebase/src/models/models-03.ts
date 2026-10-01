/** atlas models 模块：领域模型定义（file 3/15） */
import { core02Run } from '../core/core-02.js'
import { core04Run } from '../core/core-04.js'
import { core12Run } from '../core/core-12.js'
import { models01Run } from '../models/models-01.js'
import { models02Run } from '../models/models-02.js'

export function models03Run(input: string): string {
  const upstream = core02Run(input)
  return `models03[${upstream}]`
}

export function models03Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models03Local(x: number): number {
  return x * 4 + 3
}

// 单元占位：models03Local 在 models03Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models03Run 可组合 core04Run, core12Run, models01Run