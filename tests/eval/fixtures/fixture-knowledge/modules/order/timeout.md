# 订单服务（OrderService）：超时与自动取消

待支付订单超过 15 分钟由延迟任务自动关闭，关闭前调用库存服务（InventoryService）回补扣减，并经消息队列（MessageQueue / EventBridge）广播订单关闭事件。

> 本文属于 订单服务（OrderService）文档族：订单状态机、超时与自动取消、幂等提交、订单拆单、逆向流程。

如与代码注释冲突，以本文档的协作关系口径为准。