# 消息与事件

消息队列（MessageQueue，别称 EventBridge）承载全部领域事件。发布方：订单服务（OrderService）、支付服务（PaymentService）、通知服务（NotificationService）、库存服务（InventoryService）、物流服务（LogisticsService）。通知服务（NotificationService）消费这些事件驱动投递。事件按类型分 topic，消费失败指数退避，最终失败落死信。
