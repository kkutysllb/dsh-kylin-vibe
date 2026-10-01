# 购物车服务（CartService）

购物车服务（CartService）是 NovaCommerce 星帆商城的核心模块之一，管理加购、合并与结算前校验。

## 职责边界

管理加购、合并与结算前校验。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 结算前库存快照：购物车服务（CartService）使用 库存服务（InventoryService）。
- 优惠试算：购物车服务（CartService）使用 促销服务（PromotionService）。

## 相关主题

- [合并策略](merge.md)
- [结算前快照](snapshot.md)
- [优惠试算](trial.md)
- [失效清理](expiry.md)

本文档由平台架构组维护，术语以中英对照为准。