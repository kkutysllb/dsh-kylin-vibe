# 库存服务（InventoryService）

库存服务（InventoryService）是 NovaCommerce 星帆商城的核心模块之一，负责库存扣减、回补、对账与补货。

## 职责边界

负责库存扣减、回补、对账与补货。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 发布库存变更事件：库存服务（InventoryService）使用 消息队列（MessageQueue）。
- 热点 SKU 扣减串行化：库存服务（InventoryService）使用 分布式锁（DistributedLock）。
- 库存账实核对：库存服务（InventoryService）使用 对账（Reconciliation）。

## 上游依赖方

- 下单扣减/关闭回补库存：订单服务（OrderService） 使用 库存服务（InventoryService）。
- 可售位依赖库存事件：搜索服务（SearchService） 使用 库存服务（InventoryService）。
- 结算前库存快照：购物车服务（CartService） 使用 库存服务（InventoryService）。

## 相关主题

- [库存扣减](deduct.md)
- [防超卖](oversell.md)
- [库存对账](reconcile.md)
- [补货](restock.md)
- [库存快照](snapshot.md)

本文档由平台架构组维护，术语以中英对照为准。