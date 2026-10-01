# 通知服务（NotificationService）：投递可靠性

通知消费消息队列（MessageQueue / EventBridge）的事件，投递失败指数退避重试，最终失败落死信并告警。

> 本文属于 通知服务（NotificationService）文档族：通道管理、模板管理、投递可靠性、订阅偏好。

如与代码注释冲突，以本文档的协作关系口径为准。