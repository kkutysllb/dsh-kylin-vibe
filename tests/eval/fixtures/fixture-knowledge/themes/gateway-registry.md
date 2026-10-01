# 接入层：网关与注册中心

API 网关（ApiGateway）是统一入口，承担路由、限流与审计；订单、支付与搜索的对外接口均经网关暴露。服务注册（ServiceRegistry）提供服务发现与健康检查，订单服务（OrderService）与支付服务（PaymentService）的实例均注册于此。
