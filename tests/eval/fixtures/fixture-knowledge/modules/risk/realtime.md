# 风控服务（RiskControlService）：实时拦截

支付服务（PaymentService）收单前同步调用实时拦截，平均耗时预算 50ms，超时默认放行并异步复核。

> 本文属于 风控服务（RiskControlService）文档族：规则引擎、信用档案、实时拦截、灰名单、案例回溯。

如与代码注释冲突，以本文档的协作关系口径为准。