/** 冻结评测集生成器（docs/02-design/0206 §2）。
 *
 * 产物（全部确定性，种子固定，可逐字节重放）：
 *   tests/eval/fixtures/fixture-knowledge/   60 个 Markdown（虚构系统 NovaCommerce 文档）
 *   tests/eval/fixtures/fixture-codebase/    150 个 TS（虚构项目 atlas，含 import 图）
 *   tests/eval/golden/knowledge-spec.json    概念/关系 spec（黄金事实源）
 *   tests/eval/golden/codebase-graph.json    import 边集 + 反向闭包（traversal 黄金集）
 *   tests/eval/questions.json                40 题冻结（15 local / 10 global / 15 traversal）
 *
 * 黄金答案直接派生自本文件内手工编写的 spec——spec 即标注；题目只做
 * 确定性选样，禁止对着系统输出修黄金答案（0206 §5 纪律）。
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { mulberry32, rint, sample, type Prng } from './lib/prng.ts'
import type { RelationType } from '../src/core/types.ts'

const ROOT = new URL('..', import.meta.url).pathname
const SEED = 42

// ── 知识语料 spec：NovaCommerce（星帆商城）────────────────────────────────

interface ModSpec {
  readonly id: string
  readonly zh: string
  readonly en: string
  readonly duty: string
  readonly topics: readonly { readonly slug: string; readonly title: string; readonly body: string }[]
}

interface ConceptSpec {
  readonly id: string
  readonly zh: string
  readonly en: string
  readonly desc: string
}

interface RelSpec {
  readonly s: string
  readonly r: RelationType
  readonly o: string
  readonly desc: string
}

const MODS: readonly ModSpec[] = [
  {
    id: 'order', zh: '订单服务', en: 'OrderService', duty: '管理订单生命周期与状态流转，是交易链路的编排中枢',
    topics: [
      { slug: 'state-machine', title: '订单状态机', body: '订单状态机基于事件溯源（EventSourcing）实现，每次状态跃迁记录为不可变事件。状态覆盖 待支付/已支付/履约中/已完成/已关闭。幂等性（Idempotency）键防止重复跃迁。' },
      { slug: 'timeout', title: '超时与自动取消', body: '待支付订单超过 15 分钟由延迟任务自动关闭，关闭前调用库存服务（InventoryService）回补扣减，并经消息队列（MessageQueue / EventBridge）广播订单关闭事件。' },
      { slug: 'idempotency', title: '幂等提交', body: '创建订单以客户端请求号作为幂等性（Idempotency）键，重复提交返回首次结果。支付回调与状态机跃迁同样受幂等保护。' },
      { slug: 'split', title: '订单拆单', body: '跨仓订单按履约仓拆分为子单，拆单结果同步库存服务（InventoryService）与物流服务（LogisticsService），子单状态汇总驱动父单。' },
      { slug: 'reverse', title: '逆向流程', body: '退款退货走逆向流程：订单服务（OrderService）发起，支付服务（PaymentService）执行退款，库存服务（InventoryService）回补库存，通知服务（NotificationService）告知用户。' },
    ],
  },
  {
    id: 'inventory', zh: '库存服务', en: 'InventoryService', duty: '负责库存扣减、回补、对账与补货',
    topics: [
      { slug: 'deduct', title: '库存扣减', body: '下单时订单服务（OrderService）调用库存扣减接口。扣减采用预占模式：先预占、支付后实扣、关闭时释放。' },
      { slug: 'oversell', title: '防超卖', body: '热点商品扣减使用分布式锁（DistributedLock）串行化，锁粒度到 SKU；非热点走乐观扣减。超卖会在库存对账（Reconciliation）中被发现。' },
      { slug: 'reconcile', title: '库存对账', body: '库存对账（Reconciliation）每日比对流水账与现量账，差异生成调整单。对账结果经消息队列（MessageQueue / EventBridge）通知通知服务（NotificationService）推送运营。' },
      { slug: 'restock', title: '补货', body: '低于安全水位触发补货建议，补货入库后现量账更新，搜索服务（SearchService）的可售索引随之刷新。' },
      { slug: 'snapshot', title: '库存快照', body: '购物车服务（CartService）结算前读取库存快照做可行性校验，避免下单失败率过高。' },
    ],
  },
  {
    id: 'payment', zh: '支付服务', en: 'PaymentService', duty: '对接支付渠道，管理资金流水与退款',
    topics: [
      { slug: 'channels', title: '渠道适配', body: '支付服务（PaymentService）通过渠道适配层对接多个外部支付渠道（external dependency）。渠道实现统一的收单与退款接口。' },
      { slug: 'callback', title: '支付回调', body: '回调按渠道验签后落入事件流，处理结果经消息队列（MessageQueue / EventBridge）发布支付事件，订单服务（OrderService）与通知服务（NotificationService）订阅。' },
      { slug: 'fund-recon', title: '资金对账', body: '资金对账（Reconciliation）按日拉取渠道账单与本地流水比对，差异挂账并生成补单任务。' },
      { slug: 'risk-integration', title: '风控接入', body: '收单前调用风控服务（RiskControlService）做交易风险评估，高风险订单直接拦截。风控依赖用户服务（UserService）的信用档案。' },
      { slug: 'refund', title: '退款', body: '退款指令由订单逆向流程触发，退款结果同样经消息队列（MessageQueue / EventBridge）广播，幂等性（Idempotency）保证重复回调安全。' },
    ],
  },
  {
    id: 'user', zh: '用户服务', en: 'UserService', duty: '管理账户、会员等级与实名信息',
    topics: [
      { slug: 'account', title: '账户体系', body: '账户体系支撑登录与资料管理，账户状态变更事件经消息队列（MessageQueue / EventBridge）广播给订阅方。' },
      { slug: 'membership', title: '会员等级', body: '会员等级由成长值驱动，等级权益被促销服务（PromotionService）的活动规则引用。' },
      { slug: 'kyc', title: '实名认证', body: '实名认证结果供风控服务（RiskControlService）的信用档案与实时拦截规则使用。' },
      { slug: 'audience', title: '人群圈选', body: '人群圈选为促销服务（PromotionService）提供定向发券与活动投放的目标人群。' },
      { slug: 'privacy', title: '隐私与合规', body: '个人信息均脱敏落库，导出需经 API 网关（ApiGateway）的审计与授权。' },
    ],
  },
  {
    id: 'notification', zh: '通知服务', en: 'NotificationService', duty: '统一收口站内信、短信与推送的投递',
    topics: [
      { slug: 'channels', title: '通道管理', body: '通知服务（NotificationService）管理短信、推送、站内信三类通道，外部通道为 external dependency。' },
      { slug: 'templates', title: '模板管理', body: '模板按事件码组织，订单/支付/库存/物流事件各有独立模板族。' },
      { slug: 'reliability', title: '投递可靠性', body: '通知消费消息队列（MessageQueue / EventBridge）的事件，投递失败指数退避重试，最终失败落死信并告警。' },
      { slug: 'preference', title: '订阅偏好', body: '用户可在用户服务（UserService）维护的偏好上退订某类通知，投递前校验。' },
    ],
  },
  {
    id: 'search', zh: '搜索服务', en: 'SearchService', duty: '提供商品检索、筛选与排序',
    topics: [
      { slug: 'index', title: '索引构建', body: '商品索引由商品变更事件驱动增量构建，索引字段含价格、类目、销量。' },
      { slug: 'sharding', title: '索引分片', body: '索引按类目做数据库分片（DatabaseSharding），查询 fan-out 到各分片后归并。' },
      { slug: 'query', title: '查询语法', body: '查询语法支持短语、过滤与排序；查询入口统一经 API 网关（ApiGateway）暴露。' },
      { slug: 'availability', title: '无货过滤', body: '搜索结果过滤不可售商品：搜索服务（SearchService）订阅库存服务（InventoryService）的库存变更事件维护可售位。' },
    ],
  },
  {
    id: 'cart', zh: '购物车服务', en: 'CartService', duty: '管理加购、合并与结算前校验',
    topics: [
      { slug: 'merge', title: '合并策略', body: '登录后合并匿名车与会员车，合并冲突按价格与数量规则裁决。' },
      { slug: 'snapshot', title: '结算前快照', body: '结算前购物车服务（CartService）读取库存服务（InventoryService）快照做可行性校验，并固化价格快照。' },
      { slug: 'trial', title: '优惠试算', body: '购物车展示前调用促销服务（PromotionService）试算券与满减，试算不核销。' },
      { slug: 'expiry', title: '失效清理', body: '失效商品在结算时拦截并提示，加购超过 90 天的商品转入低优先级存储。' },
    ],
  },
  {
    id: 'promotion', zh: '促销服务', en: 'PromotionService', duty: '管理券、满减与活动规则',
    topics: [
      { slug: 'coupons', title: '券体系', body: '券体系含品类券、店铺券与运费券，发券人群来自用户服务（UserService）的人群圈选。' },
      { slug: 'rules', title: '满减规则', body: '满减规则引擎在订单服务（OrderService）计算应付时被调用，规则命中写订单快照。' },
      { slug: 'campaigns', title: '活动管理', body: '活动上线前做预算控制检查，预算扣减使用分布式锁（DistributedLock）防超发。' },
      { slug: 'budget', title: '预算控制', body: '活动预算与核销进度每日对账（Reconciliation），超预算自动熔断发券。' },
    ],
  },
  {
    id: 'logistics', zh: '物流服务', en: 'LogisticsService', duty: '管理发货单、轨迹与签收',
    topics: [
      { slug: 'shipment', title: '发货单', body: '发货单由订单服务（OrderService）拆单结果驱动生成，发货指令下发外部承运商（external dependency）。' },
      { slug: 'tracking', title: '轨迹订阅', body: '轨迹事件经消息队列（MessageQueue / EventBridge）流转，通知服务（NotificationService）据此推送物流状态。' },
      { slug: 'receipt', title: '签收确认', body: '签收事件回写订单服务（OrderService）驱动订单完成，超时未签收自动确认。' },
      { slug: 'reverse', title: '逆向物流', body: '退货取件与逆向仓入库由物流服务（LogisticsService）执行，入库结果触发库存回补。' },
    ],
  },
  {
    id: 'risk', zh: '风控服务', en: 'RiskControlService', duty: '交易风险评估、拦截与信用档案',
    topics: [
      { slug: 'rules', title: '规则引擎', body: '规则引擎执行实时评分，规则命中可放行/复核/拦截，决策回流支付链路。' },
      { slug: 'credit', title: '信用档案', body: '信用档案聚合用户服务（UserService）的实名与行为特征，是评分的重要输入。' },
      { slug: 'realtime', title: '实时拦截', body: '支付服务（PaymentService）收单前同步调用实时拦截，平均耗时预算 50ms，超时默认放行并异步复核。' },
      { slug: 'greylist', title: '灰名单', body: '灰名单账户限制大额交易，名单变更经消息队列（MessageQueue / EventBridge）广播。' },
      { slug: 'cases', title: '案例回溯', body: '拦截案例回溯基于事件溯源（EventSourcing）的事件流复盘，结论反哺规则。' },
    ],
  },
]

const CONCEPTS: readonly ConceptSpec[] = [
  { id: 'mq', zh: '消息队列', en: 'MessageQueue', desc: '异步事件骨干，别称 EventBridge' },
  { id: 'gateway', zh: 'API 网关', en: 'ApiGateway', desc: '统一入口，负责路由、限流与审计' },
  { id: 'esourcing', zh: '事件溯源', en: 'EventSourcing', desc: '以不可变事件流记录状态变更' },
  { id: 'dlock', zh: '分布式锁', en: 'DistributedLock', desc: '跨进程互斥，防并发超卖/超发' },
  { id: 'idem', zh: '幂等性', en: 'Idempotency', desc: '重复请求返回首次结果' },
  { id: 'recon', zh: '对账', en: 'Reconciliation', desc: '跨系统账实核对与差异处理' },
  { id: 'sharding', zh: '数据库分片', en: 'DatabaseSharding', desc: '按维度水平拆分存储' },
  { id: 'registry', zh: '服务注册', en: 'ServiceRegistry', desc: '服务发现与健康的注册中心' },
]

const RELS: readonly RelSpec[] = [
  { s: 'order', r: 'uses', o: 'inventory', desc: '下单扣减/关闭回补库存' },
  { s: 'order', r: 'uses', o: 'payment', desc: '发起收单与退款' },
  { s: 'order', r: 'uses', o: 'promotion', desc: '计算优惠并核销' },
  { s: 'order', r: 'uses', o: 'user', desc: '校验账户与收货人' },
  { s: 'order', r: 'uses', o: 'logistics', desc: '拆单驱动发货' },
  { s: 'order', r: 'uses', o: 'mq', desc: '发布订单事件' },
  { s: 'payment', r: 'uses', o: 'risk', desc: '收单前风控评估' },
  { s: 'payment', r: 'uses', o: 'mq', desc: '发布支付事件' },
  { s: 'notification', r: 'uses', o: 'mq', desc: '消费事件驱动投递' },
  { s: 'inventory', r: 'uses', o: 'mq', desc: '发布库存变更事件' },
  { s: 'logistics', r: 'uses', o: 'mq', desc: '发布轨迹事件' },
  { s: 'inventory', r: 'uses', o: 'dlock', desc: '热点 SKU 扣减串行化' },
  { s: 'promotion', r: 'uses', o: 'dlock', desc: '预算扣减防超发' },
  { s: 'inventory', r: 'uses', o: 'recon', desc: '库存账实核对' },
  { s: 'payment', r: 'uses', o: 'recon', desc: '资金账实核对' },
  { s: 'promotion', r: 'uses', o: 'recon', desc: '预算核销对账' },
  { s: 'order', r: 'uses', o: 'esourcing', desc: '状态机事件流' },
  { s: 'risk', r: 'uses', o: 'esourcing', desc: '案例回溯事件流' },
  { s: 'order', r: 'uses', o: 'idem', desc: '创建/跃迁幂等键' },
  { s: 'payment', r: 'uses', o: 'idem', desc: '回调幂等' },
  { s: 'search', r: 'uses', o: 'sharding', desc: '索引按类目分片' },
  { s: 'search', r: 'uses', o: 'inventory', desc: '可售位依赖库存事件' },
  { s: 'cart', r: 'uses', o: 'inventory', desc: '结算前库存快照' },
  { s: 'cart', r: 'uses', o: 'promotion', desc: '优惠试算' },
  { s: 'promotion', r: 'uses', o: 'user', desc: '人群圈选定向' },
  { s: 'risk', r: 'uses', o: 'user', desc: '信用档案输入' },
  { s: 'gateway', r: 'relates_to', o: 'order', desc: '入口路由' },
  { s: 'gateway', r: 'relates_to', o: 'payment', desc: '入口路由' },
  { s: 'gateway', r: 'relates_to', o: 'search', desc: '入口路由' },
  { s: 'registry', r: 'relates_to', o: 'order', desc: '服务发现' },
  { s: 'registry', r: 'relates_to', o: 'payment', desc: '服务发现' },
]

// ── 知识文档生成 ─────────────────────────────────────────────────────────────

const name = (id: string): string => {
  const m = MODS.find(x => x.id === id)
  if (m) return `${m.zh}（${m.en}）`
  const c = CONCEPTS.find(x => x.id === id)
  if (c) return `${c.zh}（${c.en}）`
  return id
}

function overviewDoc(rand: Prng, mod: ModSpec): string {
  const outgoing = RELS.filter(r => r.s === mod.id)
  const incoming = RELS.filter(r => r.o === mod.id)
  const lines: string[] = []
  lines.push(`# ${mod.zh}（${mod.en}）`, '')
  lines.push(`${mod.zh}（${mod.en}）是 NovaCommerce 星帆商城的核心模块之一，${mod.duty}。`)
  lines.push('')
  lines.push('## 职责边界', '')
  lines.push(`${mod.duty}。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / ${'`ServiceRegistry`'})。`)
  lines.push('')
  if (outgoing.length > 0) {
    lines.push('## 协作关系', '')
    for (const r of outgoing) {
      lines.push(`- ${r.desc}：${mod.zh}（${mod.en}）${relZh(r.r)} ${name(r.o)}。`)
    }
    lines.push('')
  }
  if (incoming.length > 0) {
    lines.push('## 上游依赖方', '')
    for (const r of incoming) {
      lines.push(`- ${r.desc}：${name(r.s)} ${relZh(r.r)} ${mod.zh}（${mod.en}）。`)
    }
    lines.push('')
  }
  lines.push('## 相关主题', '')
  for (const t of mod.topics) lines.push(`- [${t.title}](${t.slug}.md)`)
  lines.push('')
  lines.push(pickTail(rand))
  return lines.join('\n')
}

function themeDocs(): { readonly path: string; readonly text: string }[] {
  const mqUsers = RELS.filter(r => r.o === 'mq' && r.s !== 'gateway').map(r => r.s)
  const notifUpstream = ['order', 'payment', 'inventory', 'logistics']
  return [
    {
      path: 'themes/architecture.md',
      text: `# NovaCommerce 总体架构\n\n星帆商城由十大核心模块组成：\n\n${MODS.map(m => `- ${m.zh}（${m.en}）：${m.duty}`).join('\n')}\n\n所有同步调用经 API 网关（ApiGateway）进入，服务间异步协作以消息队列（MessageQueue / EventBridge）为骨干，服务发现依赖服务注册（ServiceRegistry）。\n`,
    },
    {
      path: 'themes/consistency.md',
      text: `# 数据一致性保障\n\nNovaCommerce 的一致性策略组合：\n\n- 对账（Reconciliation）：库存对账、资金对账与促销预算对账每日执行，差异生成调整单。\n- 事件溯源（EventSourcing）：订单状态机与风控案例回溯基于不可变事件流。\n- 幂等性（Idempotency）：订单创建、支付回调与状态跃迁均受幂等键保护。\n- 分布式锁（DistributedLock）：库存防超卖与促销预算防超发。\n`,
    },
    {
      path: 'themes/messaging.md',
      text: `# 消息与事件\n\n消息队列（MessageQueue，别称 EventBridge）承载全部领域事件。发布方：${mqUsers.map(name).join('、')}。通知服务（NotificationService）消费这些事件驱动投递。事件按类型分 topic，消费失败指数退避，最终失败落死信。\n`,
    },
    {
      path: 'themes/gateway-registry.md',
      text: `# 接入层：网关与注册中心\n\nAPI 网关（ApiGateway）是统一入口，承担路由、限流与审计；订单、支付与搜索的对外接口均经网关暴露。服务注册（ServiceRegistry）提供服务发现与健康检查，订单服务（OrderService）与支付服务（PaymentService）的实例均注册于此。\n`,
    },
    {
      path: 'themes/observability.md',
      text: `# 可观测性\n\n全链路追踪覆盖订单、支付、库存、物流等核心链路；关键事件（订单创建、支付成功、库存扣减、轨迹更新）均有结构化日志。告警经通知服务（NotificationService）的通道管理下发。\n`,
    },
    // 干扰项：实体名密集但不陈述协作关系（BM25 陷阱页）
    {
      path: 'themes/sitemap.md',
      text: `# 站点地图\n\n${MODS.map(m => `- ${m.zh}（${m.en}）`).join('\n')}\n\n另有横切主题：消息队列（MessageQueue / EventBridge）、API 网关（ApiGateway）、事件溯源（EventSourcing）、分布式锁（DistributedLock）、幂等性（Idempotency）、对账（Reconciliation）、数据库分片（DatabaseSharding）、服务注册（ServiceRegistry）。\n`,
    },
    {
      path: 'themes/changelog.md',
      text: `# 变更日志（节选）\n\n- 2026-03：订单服务（OrderService）、库存服务（InventoryService）、支付服务（PaymentService）例行依赖升级\n- 2026-04：通知服务（NotificationService）、搜索服务（SearchService）、购物车服务（CartService）性能优化\n- 2026-05：促销服务（PromotionService）、物流服务（LogisticsService）、风控服务（RiskControlService）、用户服务（UserService）缺陷修复\n- 2026-06：消息队列（MessageQueue）、API 网关（ApiGateway）、事件溯源（EventSourcing）、分布式锁（DistributedLock）配置调整\n`,
    },
  ]
}

function detailDoc(rand: Prng, mod: ModSpec, topicIndex: number): string {
  const t = mod.topics[topicIndex]
  if (t === undefined) throw new Error(`topic ${topicIndex} missing`)
  const lines: string[] = []
  lines.push(`# ${mod.zh}（${mod.en}）：${t.title}`, '')
  lines.push(t.body)
  lines.push('')
  lines.push(`> 本文属于 ${mod.zh}（${mod.en}）文档族：${mod.topics.map(x => x.title).join('、')}。`)
  lines.push('')
  lines.push(pickTail(rand))
  return lines.join('\n')
}

const TAILS = [
  '本文档由平台架构组维护，术语以中英对照为准。',
  '示例与口径以当前线上版本为准，历史版本不回溯修订。',
  '如与代码注释冲突，以本文档的协作关系口径为准。',
]

function pickTail(rand: Prng): string {
  const t = TAILS[rint(rand, 0, TAILS.length - 1)]
  if (t === undefined) throw new Error('tail missing')
  return t
}

function relZh(r: RelationType): string {
  const map: Record<RelationType, string> = {
    defines: '定义了',
    uses: '使用',
    calls: '调用',
    imports: '引入',
    depends_on: '依赖',
    configures: '配置',
    tests: '测试',
    relates_to: '关联',
  }
  return map[r]
}

// ── 代码语料生成：atlas ─────────────────────────────────────────────────────

const CODE_MODULES: readonly { readonly id: string; readonly layer: number; readonly deps: readonly string[]; readonly desc: string }[] = [
  { id: 'util', layer: 0, deps: [], desc: '通用工具函数' },
  { id: 'log', layer: 1, deps: ['util'], desc: '结构化日志' },
  { id: 'core', layer: 2, deps: ['log', 'util'], desc: '运行时核心：配置与生命周期' },
  { id: 'db', layer: 3, deps: ['core'], desc: '数据库访问层' },
  { id: 'http', layer: 3, deps: ['core'], desc: 'HTTP 服务与路由' },
  { id: 'models', layer: 3, deps: ['core'], desc: '领域模型定义' },
  { id: 'queue', layer: 4, deps: ['core'], desc: '任务队列' },
  { id: 'search', layer: 4, deps: ['models', 'db'], desc: '检索引擎适配' },
  { id: 'jobs', layer: 5, deps: ['queue', 'db'], desc: '后台任务编排' },
  { id: 'auth', layer: 6, deps: ['http', 'models', 'jobs'], desc: '认证与授权' },
]

const FILES_PER_MODULE = 15

/** traversal 种子：按闭包规模分层确定性选样（4 大 / 6 中 / 5 小），
 * 模块尽量不重复。选样只依赖黄金图，与被测系统输出无关。 */
function pickTraversalSeeds(closures: ReadonlyMap<string, readonly string[]>): string[] {
  const byClosure = [...closures.entries()]
    .filter(([, c]) => c.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const take = (min: number, max: number, count: number, used: Set<string>): string[] => {
    const out: string[] = []
    for (const [path, c] of byClosure) {
      if (out.length >= count) break
      if (c.length < min || c.length > max) continue
      const mod = path.split('/')[1] as string
      if (used.has(mod) && out.length < count - 1) {
        // 模块配额未尽时优先新模块；最后一位允许重复模块补齐
        if (byClosure.some(([p, cc]) => cc.length >= min && cc.length <= max && !used.has(p.split('/')[1] as string))) continue
      }
      out.push(path)
      used.add(mod)
    }
    return out
  }
  const used = new Set<string>()
  return [...take(40, Infinity, 4, used), ...take(10, 39, 6, used), ...take(2, 9, 5, used)]
}

interface CodeEdge { readonly from: string; readonly to: string }

function genCodebase(rand: Prng): { files: { path: string; text: string }[]; edges: CodeEdge[] } {
  const files: { path: string; text: string }[] = []
  const edges: CodeEdge[] = []
  const modById = new Map(CODE_MODULES.map(m => [m.id, m]))

  for (const mod of CODE_MODULES) {
    for (let i = 1; i <= FILES_PER_MODULE; i++) {
      const path = `src/${mod.id}/${mod.id}-${String(i).padStart(2, '0')}.ts`
      const imports = new Set<string>()
      // 模块主干：01 号文件引入每个依赖模块的 01 号文件
      if (i === 1) {
        for (const dep of mod.deps) imports.add(`src/${dep}/${dep}-01.ts`)
      }
      // 模块内：本模块 01 号是天然 hub（人人引入）+ 1-2 个更早文件
      if (i > 1) {
        imports.add(`src/${mod.id}/${mod.id}-01.ts`)
        for (const p of sample(rand, range(i - 1).map(k => `src/${mod.id}/${mod.id}-${pad(k + 1)}.ts`), i >= 3 ? 2 : 1)) imports.add(p)
      }
      // 跨模块：每个依赖模块取 1-3 个文件，序号向低位偏置（形成跨模块 hub）
      for (const dep of mod.deps) {
        const n = rint(rand, 1, 3)
        for (let k = 0; k < n; k++) {
          const biased = Math.floor(Math.pow(rand(), 1.8) * FILES_PER_MODULE)
          imports.add(`src/${dep}/${dep}-${pad(biased + 1)}.ts`)
        }
      }
      const importList = [...imports].sort()
      for (const to of importList) edges.push({ from: path, to })

      const fnBase = `${mod.id}${String(i).padStart(2, '0')}`
      const importNames = importList.map(to => {
        const m = /\/(\w+)-(\d+)\.ts$/.exec(to)
        if (!m) throw new Error(`bad import path: ${to}`)
        return `${m[1]}${m[2]}Run`
      })
      const body: string[] = []
      body.push(`/** atlas ${mod.id} 模块：${mod.desc}（file ${i}/${FILES_PER_MODULE}） */`)
      if (importList.length > 0) {
        body.push(...importList.map((to, k) => `import { ${importNames[k]} } from '../${to.slice('src/'.length, -3)}.js'`))
      }
      body.push('')
      body.push(`export function ${fnBase}Run(input: string): string {`)
      if (importNames.length > 0) {
        body.push(`  const upstream = ${importNames[0]}(input)`)
        body.push(`  return \`${fnBase}[\${upstream}]\``)
      } else {
        body.push(`  return \`${fnBase}[\${input}]\``)
      }
      body.push('}')
      body.push('')
      body.push(`export function ${fnBase}Describe(): string {`)
      body.push(`  return 'atlas/${mod.id}: ${mod.desc}, module layer ${mod.layer}, deps: [${mod.deps.join(', ')}]'`)
      body.push('}')
      body.push('')
      body.push(`function ${fnBase}Local(x: number): number {`)
      body.push(`  return x * ${i + 1} + ${mod.layer}`)
      body.push('}')
      body.push('')
      body.push(`// 单元占位：${fnBase}Local 在 ${fnBase}Run 的扩展场景中使用`)
      body.push(`// 本文件属于 atlas 项目的 ${mod.id} 模块（${mod.desc}）`)
      if (importNames.length > 1) {
        body.push(`// 扩展路径：${fnBase}Run 可组合 ${importNames.slice(1, 4).join(', ')}`)
      }
      files.push({ path, text: body.join('\n') })
    }
  }
  return { files, edges }
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, k) => k)
}
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 反向传递闭包：传递依赖 seed 的文件集合（import seed 的传递上游）。 */
function reverseClosure(edges: readonly CodeEdge[], seed: string): string[] {
  const importers = new Map<string, Set<string>>()
  for (const e of edges) {
    let set = importers.get(e.to)
    if (!set) { set = new Set(); importers.set(e.to, set) }
    set.add(e.from)
  }
  const seen = new Set<string>()
  const queue = [seed]
  while (queue.length > 0) {
    const cur = queue.shift() as string
    for (const next of importers.get(cur) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next) }
    }
  }
  return [...seen].sort()
}

// ── 问题集生成（40 题冻结）─────────────────────────────────────────────────

const LOCAL_TEMPLATES = [
  '{X}与{Y}之间是如何协作的？',
  '{X}和{Y}的关联机制是什么？',
  '说明{X}与{Y}的依赖关系。',
  '{X}怎样影响{Y}？',
]

/** 5 题机制化改写：不以实体名提问，逼检索走语义/图而非字面命中。 */
const LOCAL_PARAPHRASE: Readonly<Record<string, string>> = {
  'order>inventory': '下单时库存是如何被扣减和回补的？',
  'payment>risk': '交易前风控是怎么接入收单流程的？',
  'cart>promotion': '购物车里展示的优惠是怎么算出来的？',
  'search>inventory': '搜索结果为什么能过滤掉无货商品？',
  'order>notification': '订单状态变化后用户是怎么收到通知的？',
}

interface Question {
  readonly id: string
  readonly type: 'local' | 'global' | 'traversal'
  readonly question: string
  readonly golden: unknown
}

function genQuestions(rand: Prng, codeEdges: readonly CodeEdge[], traversalSeeds: readonly string[]): Question[] {
  const qs: Question[] = []

  // 15 local：10 条直接关系 + 5 条经概念中介
  const directPicks = ['order>inventory', 'order>payment', 'order>promotion', 'payment>risk', 'search>inventory',
    'cart>promotion', 'order>logistics', 'promotion>user', 'cart>inventory', 'order>user']
  let n = 0
  for (const pick of directPicks) {
    const [s, o] = pick.split('>') as [string, string]
    const rel = RELS.find(r => r.s === s && r.o === o)
    if (!rel) throw new Error(`spec missing direct rel ${pick}`)
    const paraphrased = LOCAL_PARAPHRASE[pick]
    const tpl = LOCAL_TEMPLATES[n % LOCAL_TEMPLATES.length] as string
    qs.push({
      id: `L${String(++n).padStart(2, '0')}`,
      type: 'local',
      question: paraphrased ?? tpl.replaceAll('{X}', nameZhOnly(s)).replaceAll('{Y}', nameZhOnly(o)),
      golden: {
        entities: [acceptedNames(s), acceptedNames(o)],
        relations: [{ s: nameZhOnly(s), r: rel.r, o: nameZhOnly(o) }],
      },
    })
  }
  const mediated: readonly { readonly a: string; readonly b: string; readonly via: string }[] = [
    { a: 'order', b: 'notification', via: 'mq' },
    { a: 'payment', b: 'notification', via: 'mq' },
    { a: 'inventory', b: 'notification', via: 'mq' },
    { a: 'order', b: 'idem', via: 'order' },
    { a: 'inventory', b: 'dlock', via: 'inventory' },
  ]
  for (const m of mediated) {
    const rels = RELS.filter(r =>
      (r.s === m.a && r.o === m.b) || (r.s === m.b && r.o === m.a)
      || (r.s === m.a && r.o === m.via) || (r.s === m.b && r.o === m.via))
    const tpl = LOCAL_TEMPLATES[n % LOCAL_TEMPLATES.length] as string
    qs.push({
      id: `L${String(++n).padStart(2, '0')}`,
      type: 'local',
      question: tpl.replaceAll('{X}', nameZhOnly(m.a)).replaceAll('{Y}', nameZhOnly(m.b)),
      golden: {
        entities: [acceptedNames(m.a), acceptedNames(m.b), ...(m.via !== m.a && m.via !== m.b ? [acceptedNames(m.via)] : [])],
        relations: rels.map(r => ({ s: nameZhOnly(r.s), r: r.r, o: nameZhOnly(r.o) })),
      },
    })
  }

  // 10 global
  const globals: readonly { readonly q: string; readonly points: readonly (readonly string[])[] }[] = [
    { q: 'NovaCommerce 星帆商城由哪些主要模块组成，各自职责是什么？', points: MODS.map(m => [m.zh, m.en]) },
    { q: '哪些模块依赖消息队列（EventBridge）做异步协作？', points: [['order', 'OrderService'], ['payment', 'PaymentService'], ['inventory', 'InventoryService'], ['logistics', 'LogisticsService'], ['notification', 'NotificationService'], ['消息队列', 'MessageQueue']] },
    { q: '系统的数据一致性靠哪些机制保障？', points: [['对账', 'Reconciliation'], ['事件溯源', 'EventSourcing'], ['幂等性', 'Idempotency'], ['分布式锁', 'DistributedLock']] },
    { q: '通知服务为哪些模块的事件发送通知？', points: [['order', 'OrderService'], ['payment', 'PaymentService'], ['inventory', 'InventoryService'], ['logistics', 'LogisticsService']] },
    { q: '交易链路上的风控是如何接入的？', points: [['风控服务', 'RiskControlService'], ['支付服务', 'PaymentService'], ['用户服务', 'UserService'], ['信用档案']] },
    { q: '库存相关的核心机制有哪些？', points: [['库存服务', 'InventoryService'], ['分布式锁', 'DistributedLock'], ['对账', 'Reconciliation'], ['预占']] },
    { q: '系统对外的统一入口是什么，哪些服务经它暴露？', points: [['API 网关', 'ApiGateway'], ['order', 'OrderService'], ['payment', 'PaymentService'], ['搜索服务', 'SearchService']] },
    { q: '促销能力与哪些模块有协作？', points: [['促销服务', 'PromotionService'], ['购物车服务', 'CartService'], ['订单服务', 'OrderService'], ['用户服务', 'UserService']] },
    { q: '搜索服务的实现依赖什么？', points: [['搜索服务', 'SearchService'], ['数据库分片', 'DatabaseSharding'], ['库存服务', 'InventoryService']] },
    { q: '订单服务的依赖全景是什么？', points: [['订单服务', 'OrderService'], ['库存服务', 'InventoryService'], ['支付服务', 'PaymentService'], ['促销服务', 'PromotionService'], ['用户服务', 'UserService'], ['物流服务', 'LogisticsService']] },
  ]
  for (let i = 0; i < globals.length; i++) {
    const g = globals[i]
    if (!g) continue
    qs.push({ id: `G${String(i + 1).padStart(2, '0')}`, type: 'global', question: g.q, golden: { points: g.points } })
  }

  // 15 traversal：种子由黄金图分层确定性选出
  let t = 0
  for (const seed of traversalSeeds) {
    qs.push({
      id: `T${String(++t).padStart(2, '0')}`,
      type: 'traversal',
      question: `在 atlas 项目中，如果修改 ${seed} 这个文件，会影响哪些文件？（列出受影响的文件路径）`,
      golden: { seedFile: seed, goldenFiles: reverseClosure(codeEdges, seed) },
    })
  }
  return qs
}

function nameZhOnly(id: string): string {
  const m = MODS.find(x => x.id === id)
  if (m) return m.zh
  const c = CONCEPTS.find(x => x.id === id)
  if (c) return c.zh
  return id
}

/** 一个黄金实体组的可接受名（中文名 + 英文名）。 */
function acceptedNames(id: string): string[] {
  const m = MODS.find(x => x.id === id)
  if (m) return [m.zh, m.en]
  const c = CONCEPTS.find(x => x.id === id)
  if (c) return [c.zh, c.en]
  return [id]
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

function main(): void {
  const rand = mulberry32(SEED)
  const fixRoot = join(ROOT, 'tests/eval/fixtures')
  const goldenRoot = join(ROOT, 'tests/eval/golden')

  // 知识语料
  const kRoot = join(fixRoot, 'fixture-knowledge')
  rmSync(kRoot, { recursive: true, force: true })
  let count = 0
  for (const mod of MODS) {
    mkdirSync(join(kRoot, 'modules', mod.id), { recursive: true })
    writeFileSync(join(kRoot, 'modules', mod.id, 'overview.md'), overviewDoc(rand, mod))
    count++
    mod.topics.forEach((_, i) => {
      writeFileSync(join(kRoot, 'modules', mod.id, mod.topics[i]!.slug + '.md'), detailDoc(rand, mod, i))
      count++
    })
  }
  mkdirSync(join(kRoot, 'themes'), { recursive: true })
  for (const t of themeDocs()) {
    writeFileSync(join(kRoot, t.path), t.text)
    count++
  }
  console.log(`fixture-knowledge: ${count} files`)

  // 代码语料
  const cRoot = join(fixRoot, 'fixture-codebase')
  rmSync(cRoot, { recursive: true, force: true })
  const code = genCodebase(rand)
  for (const f of code.files) {
    mkdirSync(join(cRoot, f.path.slice(0, f.path.lastIndexOf('/'))), { recursive: true })
    writeFileSync(join(cRoot, f.path), f.text)
  }
  console.log(`fixture-codebase: ${code.files.length} files, ${code.edges.length} import edges`)

  // 黄金数据
  mkdirSync(goldenRoot, { recursive: true })
  writeFileSync(join(goldenRoot, 'knowledge-spec.json'), JSON.stringify({
    version: 1,
    modules: MODS.map(m => ({ id: m.id, zh: m.zh, en: m.en, duty: m.duty, topics: m.topics.map(t => t.title) })),
    concepts: CONCEPTS,
    relations: RELS,
  }, null, 2))

  // traversal 种子：全量闭包 → 分层选样；黄金闭包只存种子相关
  const closuresAll = new Map(code.files.map(f => [f.path, reverseClosure(code.edges, f.path)]))
  const seeds = pickTraversalSeeds(closuresAll)
  const closures = Object.fromEntries(seeds.map(s => [s, closuresAll.get(s) ?? []]))
  writeFileSync(join(goldenRoot, 'codebase-graph.json'), JSON.stringify({
    version: 1,
    modules: CODE_MODULES,
    edges: code.edges,
    closures,
  }, null, 2))

  // 问题集（冻结）
  const questions = genQuestions(rand, code.edges, seeds)
  writeFileSync(join(ROOT, 'tests/eval/questions.json'), JSON.stringify({
    version: 1,
    frozen: true,
    frozenAt: '2026-10-01',
    changelog: 'v1 由 spec 派生冻结；修改黄金答案必须新建版本并在 docs/02-design/0206 纪律下记录理由',
    counts: { local: 15, global: 10, traversal: 15 },
    questions,
  }, null, 2))
  console.log(`questions: ${questions.length} frozen`)
}

main()
