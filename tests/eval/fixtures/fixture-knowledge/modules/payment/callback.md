# 支付服务（PaymentService）：支付回调

回调按渠道验签后落入事件流，处理结果经消息队列（MessageQueue / EventBridge）发布支付事件，订单服务（OrderService）与通知服务（NotificationService）订阅。

> 本文属于 支付服务（PaymentService）文档族：渠道适配、支付回调、资金对账、风控接入、退款。

本文档由平台架构组维护，术语以中英对照为准。