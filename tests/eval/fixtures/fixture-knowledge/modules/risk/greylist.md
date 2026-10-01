# 风控服务（RiskControlService）：灰名单

灰名单账户限制大额交易，名单变更经消息队列（MessageQueue / EventBridge）广播。

> 本文属于 风控服务（RiskControlService）文档族：规则引擎、信用档案、实时拦截、灰名单、案例回溯。

如与代码注释冲突，以本文档的协作关系口径为准。