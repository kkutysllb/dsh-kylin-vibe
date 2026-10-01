# 支付服务（PaymentService）：风控接入

收单前调用风控服务（RiskControlService）做交易风险评估，高风险订单直接拦截。风控依赖用户服务（UserService）的信用档案。

> 本文属于 支付服务（PaymentService）文档族：渠道适配、支付回调、资金对账、风控接入、退款。

如与代码注释冲突，以本文档的协作关系口径为准。