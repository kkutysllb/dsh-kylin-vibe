# 数据一致性保障

NovaCommerce 的一致性策略组合：

- 对账（Reconciliation）：库存对账、资金对账与促销预算对账每日执行，差异生成调整单。
- 事件溯源（EventSourcing）：订单状态机与风控案例回溯基于不可变事件流。
- 幂等性（Idempotency）：订单创建、支付回调与状态跃迁均受幂等键保护。
- 分布式锁（DistributedLock）：库存防超卖与促销预算防超发。
