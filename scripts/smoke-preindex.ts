/** 冒烟预索引（M3-W1 v2：KB 流程）：headless 宿主对需审批操作自动拒绝
 * （fail-closed），故在带外用插件自身引擎预建 KB 与索引到宿主 provider
 * 读取的同一数据目录（kbs.json 注册 + kbs/<id>/graphrag.db），让宿主侧
 * 验证检索环（query/graph/status 只读路径不经审批）。
 *
 * 抽取器用确定性 fixture（与 tests 一致）；宿主侧 llmAvailable 已实测为 true，
 * 抽取质量评估与检索验证解耦（0206 oracle 纪律）。
 */
import assert from 'node:assert/strict'

import { clampConfig, LocalGraphRagProvider } from '../src/provider.ts'
import type { LlmCompleter } from '../src/core/extractor.ts'

const KB_NAME = process.argv[2] ?? '冒烟库'
const KNOWN = ['订单服务', '库存服务', '通知服务']
const llm: LlmCompleter = {
  complete: async (_s, user) => {
    if (user.includes('社区主题摘要')) return JSON.stringify({ summary: `社区：${KNOWN.join('、')}`, top: KNOWN })
    const found = KNOWN.filter(n => user.includes(n))
    const rels: { s: string; r: string; o: string; d: null; c: number }[] = []
    for (let i = 0; i + 1 < found.length; i += 2) rels.push({ s: found[i] as string, r: 'uses', o: found[i + 1] as string, d: null, c: 0.8 })
    return JSON.stringify({ entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })), relations: rels })
  },
}

const provider = new LocalGraphRagProvider(clampConfig({
  dataDir: '/tmp/graphrag-smoke-data',
}), { ctx: null, llm })

let kb = provider.listKbs().find(k => k.name === KB_NAME)
if (kb === undefined) {
  kb = provider.createKb({ name: KB_NAME, roots: ['/tmp/graphrag-smoke-corpus'], description: 'graphrag 冒烟库' })
}
const report = await provider.index({ name: KB_NAME }, {}, new AbortController().signal)
console.log('index report:', JSON.stringify(report))
const status = await provider.status({ name: KB_NAME })
console.log('status:', JSON.stringify(status))
assert.equal(report.aborted, false)
provider.dispose()
console.log(`pre-index OK: kb="${KB_NAME}" (id=${kb.id})`)
