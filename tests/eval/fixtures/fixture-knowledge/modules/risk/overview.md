# 风控服务（RiskControlService）

风控服务（RiskControlService）是 NovaCommerce 星帆商城的核心模块之一，交易风险评估、拦截与信用档案。

## 职责边界

交易风险评估、拦截与信用档案。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 案例回溯事件流：风控服务（RiskControlService）使用 事件溯源（EventSourcing）。
- 信用档案输入：风控服务（RiskControlService）使用 用户服务（UserService）。

## 上游依赖方

- 收单前风控评估：支付服务（PaymentService） 使用 风控服务（RiskControlService）。

## 相关主题

- [规则引擎](rules.md)
- [信用档案](credit.md)
- [实时拦截](realtime.md)
- [灰名单](greylist.md)
- [案例回溯](cases.md)

本文档由平台架构组维护，术语以中英对照为准。