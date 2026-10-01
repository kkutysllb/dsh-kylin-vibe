# 库存服务（InventoryService）：防超卖

热点商品扣减使用分布式锁（DistributedLock）串行化，锁粒度到 SKU；非热点走乐观扣减。超卖会在库存对账（Reconciliation）中被发现。

> 本文属于 库存服务（InventoryService）文档族：库存扣减、防超卖、库存对账、补货、库存快照。

如与代码注释冲突，以本文档的协作关系口径为准。