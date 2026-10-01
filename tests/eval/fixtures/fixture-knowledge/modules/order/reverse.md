# 订单服务（OrderService）：逆向流程

退款退货走逆向流程：订单服务（OrderService）发起，支付服务（PaymentService）执行退款，库存服务（InventoryService）回补库存，通知服务（NotificationService）告知用户。

> 本文属于 订单服务（OrderService）文档族：订单状态机、超时与自动取消、幂等提交、订单拆单、逆向流程。

示例与口径以当前线上版本为准，历史版本不回溯修订。