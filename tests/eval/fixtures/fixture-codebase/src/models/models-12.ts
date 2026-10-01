/** atlas models 模块：领域模型定义（file 12/15） */
import { core04Run } from '../core/core-04.js'
import { core06Run } from '../core/core-06.js'
import { models01Run } from '../models/models-01.js'
import { models06Run } from '../models/models-06.js'
import { models07Run } from '../models/models-07.js'

export function models12Run(input: string): string {
  const upstream = core04Run(input)
  return `models12[${upstream}]`
}

export function models12Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models12Local(x: number): number {
  return x * 13 + 3
}

// 单元占位：models12Local 在 models12Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models12Run 可组合 core06Run, models01Run, models06Run