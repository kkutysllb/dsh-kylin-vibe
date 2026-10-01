# 订单服务（OrderService）：订单拆单

跨仓订单按履约仓拆分为子单，拆单结果同步库存服务（InventoryService）与物流服务（LogisticsService），子单状态汇总驱动父单。

> 本文属于 订单服务（OrderService）文档族：订单状态机、超时与自动取消、幂等提交、订单拆单、逆向流程。

本文档由平台架构组维护，术语以中英对照为准。