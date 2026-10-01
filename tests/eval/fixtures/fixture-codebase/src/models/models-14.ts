/** atlas models 模块：领域模型定义（file 14/15） */
import { core02Run } from '../core/core-02.js'
import { core07Run } from '../core/core-07.js'
import { core14Run } from '../core/core-14.js'
import { models01Run } from '../models/models-01.js'
import { models03Run } from '../models/models-03.js'
import { models06Run } from '../models/models-06.js'

export function models14Run(input: string): string {
  const upstream = core02Run(input)
  return `models14[${upstream}]`
}

export function models14Describe(): string {
  return 'atlas/models: 领域模型定义, module layer 3, deps: [core]'
}

function models14Local(x: number): number {
  return x * 15 + 3
}

// 单元占位：models14Local 在 models14Run 的扩展场景中使用
// 本文件属于 atlas 项目的 models 模块（领域模型定义）
// 扩展路径：models14Run 可组合 core07Run, core14Run, models01Run