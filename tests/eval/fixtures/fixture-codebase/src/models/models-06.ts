/** atlas models 模块：领域模型定义（file 6/15） */
import { core01Run } from '../core/core-01.js'
import { core11Run } from '../core/core-11.js'
import { core15Run } from '../core/core-15.js'
import { models01Run } from '../models/models-01.js'
import { models02Run } from '../models/models-02.js'
import { models04Run } from '../models/models-04.js'

export function models06Run(input: string): string {
  const upstream = core01Run(input)
  return `models06[${upstream}]`
}

export function models06Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models06Local(x: number): number {
  return x * 7 + 3
}

// 单元占位：models06Local 在 models06Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models06Run 可组合 core11Run, core15Run, models01Run