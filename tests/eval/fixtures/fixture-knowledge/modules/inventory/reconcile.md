# 库存服务（InventoryService）：库存对账

库存对账（Reconciliation）每日比对流水账与现量账，差异生成调整单。对账结果经消息队列（MessageQueue / EventBridge）通知通知服务（NotificationService）推送运营。

> 本文属于 库存服务（InventoryService）文档族：库存扣减、防超卖、库存对账、补货、库存快照。

示例与口径以当前线上版本为准，历史版本不回溯修订。