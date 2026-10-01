# 搜索服务（SearchService）

搜索服务（SearchService）是 NovaCommerce 星帆商城的核心模块之一，提供商品检索、筛选与排序。

## 职责边界

提供商品检索、筛选与排序。对外的同步接口统一经 API 网关（ApiGateway）暴露，实例注册到服务注册（ServiceRegistry / `ServiceRegistry`)。

## 协作关系

- 索引按类目分片：搜索服务（SearchService）使用 数据库分片（DatabaseSharding）。
- 可售位依赖库存事件：搜索服务（SearchService）使用 库存服务（InventoryService）。

## 上游依赖方

- 入口路由：API 网关（ApiGateway） 关联 搜索服务（SearchService）。

## 相关主题

- [索引构建](index.md)
- [索引分片](sharding.md)
- [查询语法](query.md)
- [无货过滤](availability.md)

本文档由平台架构组维护，术语以中英对照为准。