# NovaCommerce 总体架构

星帆商城由十大核心模块组成：

- 订单服务（OrderService）：管理订单生命周期与状态流转，是交易链路的编排中枢
- 库存服务（InventoryService）：负责库存扣减、回补、对账与补货
- 支付服务（PaymentService）：对接支付渠道，管理资金流水与退款
- 用户服务（UserService）：管理账户、会员等级与实名信息
- 通知服务（NotificationService）：统一收口站内信、短信与推送的投递
- 搜索服务（SearchService）：提供商品检索、筛选与排序
- 购物车服务（CartService）：管理加购、合并与结算前校验
- 促销服务（PromotionService）：管理券、满减与活动规则
- 物流服务（LogisticsService）：管理发货单、轨迹与签收
- 风控服务（RiskControlService）：交易风险评估、拦截与信用档案

所有同步调用经 API 网关（ApiGateway）进入，服务间异步协作以消息队列（MessageQueue / EventBridge）为骨干，服务发现依赖服务注册（ServiceRegistry）。
