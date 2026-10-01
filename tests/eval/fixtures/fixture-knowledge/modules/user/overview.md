# 用户服务（UserService）

用户服务（UserService）是 NovaCommerce 星帆商城的核心模块之一，管理账户、会员等级与实名信息。

## 职责边界

管理账户、会员等级与实名信息。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 上游依赖方

- 校验账户与收货人：订单服务（OrderService） 使用 用户服务（UserService）。
- 人群圈选定向：促销服务（PromotionService） 使用 用户服务（UserService）。
- 信用档案输入：风控服务（RiskControlService） 使用 用户服务（UserService）。

## 相关主题

- [账户体系](account.md)
- [会员等级](membership.md)
- [实名认证](kyc.md)
- [人群圈选](audience.md)
- [隐私与合规](privacy.md)

本文档由平台架构组维护，术语以中英对照为准。