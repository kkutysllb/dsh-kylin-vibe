# 物流服务（LogisticsService）

物流服务（LogisticsService）是 NovaCommerce 星帆商城的核心模块之一，管理发货单、轨迹与签收。

## 职责边界

管理发货单、轨迹与签收。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 发布轨迹事件：物流服务（LogisticsService）使用 消息队列（MessageQueue）。

## 上游依赖方

- 拆单驱动发货：订单服务（OrderService） 使用 物流服务（LogisticsService）。

## 相关主题

- [发货单](shipment.md)
- [轨迹订阅](tracking.md)
- [签收确认](receipt.md)
- [逆向物流](reverse.md)

如与代码注释冲突，以本文档的协作关系口径为准。