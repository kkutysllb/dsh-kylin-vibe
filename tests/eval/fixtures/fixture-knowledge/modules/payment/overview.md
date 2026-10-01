# 支付服务（PaymentService）

支付服务（PaymentService）是 NovaCommerce 星帆商城的核心模块之一，对接支付渠道，管理资金流水与退款。

## 职责边界

对接支付渠道，管理资金流水与退款。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 收单前风控评估：支付服务（PaymentService）使用 风控服务（RiskControlService）。
- 发布支付事件：支付服务（PaymentService）使用 消息队列（MessageQueue）。
- 资金账实核对：支付服务（PaymentService）使用 对账（Reconciliation）。
- 回调幂等：支付服务（PaymentService）使用 幂等性（Idempotency）。

## 上游依赖方

- 发起收单与退款：订单服务（OrderService） 使用 支付服务（PaymentService）。
- 入口路由：API 网关（ApiGateway） 关联 支付服务（PaymentService）。
- 服务发现：服务注册（ServiceRegistry） 关联 支付服务（PaymentService）。

## 相关主题

- [渠道适配](channels.md)
- [支付回调](callback.md)
- [资金对账](fund-recon.md)
- [风控接入](risk-integration.md)
- [退款](refund.md)

如与代码注释冲突，以本文档的协作关系口径为准。