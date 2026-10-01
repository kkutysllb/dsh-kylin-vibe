# 订单服务（OrderService）

订单服务（OrderService）是 NovaCommerce 星帆商城的核心模块之一，管理订单生命周期与状态流转，是交易链路的编排中枢。

## 职责边界

管理订单生命周期与状态流转，是交易链路的编排中枢。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 下单扣减/关闭回补库存：订单服务（OrderService）使用 库存服务（InventoryService）。
- 发起收单与退款：订单服务（OrderService）使用 支付服务（PaymentService）。
- 计算优惠并核销：订单服务（OrderService）使用 促销服务（PromotionService）。
- 校验账户与收货人：订单服务（OrderService）使用 用户服务（UserService）。
- 拆单驱动发货：订单服务（OrderService）使用 物流服务（LogisticsService）。
- 发布订单事件：订单服务（OrderService）使用 消息队列（MessageQueue）。
- 状态机事件流：订单服务（OrderService）使用 事件溯源（EventSourcing）。
- 创建/跃迁幂等键：订单服务（OrderService）使用 幂等性（Idempotency）。

## 上游依赖方

- 入口路由：API 网关（ApiGateway） 关联 订单服务（OrderService）。
- 服务发现：服务注册（ServiceRegistry） 关联 订单服务（OrderService）。

## 相关主题

- [订单状态机](state-machine.md)
- [超时与自动取消](timeout.md)
- [幂等提交](idempotency.md)
- [订单拆单](split.md)
- [逆向流程](reverse.md)

示例与口径以当前线上版本为准，历史版本不回溯修订。