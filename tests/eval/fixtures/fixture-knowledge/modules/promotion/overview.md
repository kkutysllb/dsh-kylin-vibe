# 促销服务（PromotionService）

促销服务（PromotionService）是 NovaCommerce 星帆商城的核心模块之一，管理券、满减与活动规则。

## 职责边界

管理券、满减与活动规则。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 预算扣减防超发：促销服务（PromotionService）使用 分布式锁（DistributedLock）。
- 预算核销对账：促销服务（PromotionService）使用 对账（Reconciliation）。
- 人群圈选定向：促销服务（PromotionService）使用 用户服务（UserService）。

## 上游依赖方

- 计算优惠并核销：订单服务（OrderService） 使用 促销服务（PromotionService）。
- 优惠试算：购物车服务（CartService） 使用 促销服务（PromotionService）。

## 相关主题

- [券体系](coupons.md)
- [满减规则](rules.md)
- [活动管理](campaigns.md)
- [预算控制](budget.md)

示例与口径以当前线上版本为准，历史版本不回溯修订。