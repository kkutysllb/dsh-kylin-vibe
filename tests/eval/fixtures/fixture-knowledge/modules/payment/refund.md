# 支付服务（PaymentService）：退款

退款指令由订单逆向流程触发，退款结果同样经消息队列（MessageQueue / EventBridge）广播，幂等性（Idempotency）保证重复回调安全。

> 本文属于 支付服务（PaymentService）文档族：渠道适配、支付回调、资金对账、风控接入、退款。

示例与口径以当前线上版本为准，历史版本不回溯修订。