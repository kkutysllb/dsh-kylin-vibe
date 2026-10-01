# 通知服务（NotificationService）

通知服务（NotificationService）是 NovaCommerce 星帆商城的核心模块之一，统一收口站内信、短信与推送的投递。

## 职责边界

统一收口站内信、短信与推送的投递。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 消费事件驱动投递：通知服务（NotificationService）使用 消息队列（MessageQueue）。

## 相关主题

- [通道管理](channels.md)
- [模板管理](templates.md)
- [投递可靠性](reliability.md)
- [订阅偏好](preference.md)

本文档由平台架构组维护，术语以中英对照为准。