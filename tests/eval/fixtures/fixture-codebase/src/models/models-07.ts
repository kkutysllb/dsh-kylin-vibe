/** atlas models 模块：领域模型定义（file 7/15） */
import { core04Run } from '../core/core-04.js'
import { core10Run } from '../core/core-10.js'
import { models01Run } from '../models/models-01.js'
import { models02Run } from '../models/models-02.js'
import { models03Run } from '../models/models-03.js'

export function models07Run(input: string): string {
  const upstream = core04Run(input)
  return `models07[${upstream}]`
}

export function models07Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models07Local(x: number): number {
  return x * 8 + 3
}

// 单元占位：models07Local 在 models07Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models07Run 可组合 core10Run, models01Run, models02Run