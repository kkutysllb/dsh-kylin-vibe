# dsh-kylin-vibe

**dsh-kylin-vibe**：DeepSeek Harness（dsh）与 QiLin（麒麟）双引擎的 GraphRAG 插件。把显式授权的本地语料（代码/文档）增量索引成知识图谱（实体-关系-社区），以 agent 工具形式暴露，供模型在任务执行中做关系性/全局性推理检索。

当前阶段：**M3-W1 完成（2026-10-02，103/103 测试）——多知识库落地**：KB 一等实体（kbs.json 注册表 / 命名 / 建库 / 删除 / 迁移）、provider v2 解析链（显式 kb 参数 → cwd 命中 → 唯一库 → 候选名单）、工具 kb 参数与 create 语义，均经真实宿主（~/.kcoder-dev）回归验证（旧布局迁移实测 + 多库显式选择检索全通）。下一步 M3-W2：Web RPC + KB 管理页 + 索引进度（见 [0207](docs/02-design/0207-用户入口与多知识库设计.md)）。——用户质询"用户入口 / 任务绑定知识库 / 准确性验证"暴露 ADR-10 判断错误，面板从可选件升级为核心（ADR-12）。M3 按 [0207 用户入口与多知识库设计](docs/02-design/0207-用户入口与多知识库设计.md) 执行：KB 一等实体（多库命名/选择/绑定）→ Web 管理面板（建库/索引/进度/浏览）→ 抽样审查（精确率 + 体检报告）→ QiLin 通道。详见 [实施计划](docs/03-plan/0301-实施计划.md)。

开发速览：

```sh
pnpm install          # autoInstallPeers=false（宿主 peer 由宿主注入）
pnpm check            # typecheck + 92 测试 + esbuild 三入口 bundle + smoke
pnpm fixtures:gen     # 重放生成冻结评测集（种子 42，逐字节可复现）
pnpm eval             # 冻结评测：--config flat-bm25|graph-local|graph-full（graph 配置自动附门槛判定）

# 安装到本机宿主（~/.kcoder-dev）：
DSH_HOME=~/.kcoder-dev dsh plugin --profile web add link:/Users/libing/kk_Projects/dsh-kylin-vibe
```

## 文档索引

### 第一批 · 技术文档（01-tech）

| 文档 | 内容 |
|---|---|
| [0101 生态调研与竞品分析](docs/01-tech/0101-生态调研与竞品分析.md) | dsh 插件生态扫描；graph-memory（633★）/ DSH-RAG / dsh-ragflow 三项目深入分析；生态空白点结论 |
| [0102 GraphRAG 技术原理与检索策略](docs/01-tech/0102-GraphRAG技术原理与检索策略.md) | 平铺 RAG 的短板与图谱补位；Microsoft GraphRAG vs 轻量化变体；本项目技术路线（local/global/traversal 三模式、证据纪律、成本纪律） |
| [0103 双引擎兼容性研究](docs/01-tech/0103-双引擎兼容性研究.md) | dsh + QiLin 同源性论证；宿主服务面契约（tools/llm/systemPrompt/pre-execute）；dsh-kylin-automation 参照模式；兼容边界与风险 |
| [0104 技术选型决策记录](docs/01-tech/0104-技术选型决策记录.md) | ADR-1..11：运行时、node:sqlite、ctx.llm 零凭据、LPA、PPR+词法基线、增量索引、三角色打包、显式授权等 |

### 第二批 · 工程化落地方案设计（02-design）

| 文档 | 内容 |
|---|---|
| [0201 总体架构设计](docs/02-design/0201-总体架构设计.md) | 三角色四入口（seam/provider/consumer）；仓库布局；GraphRagService 契约；三条主数据流；横切关注点 |
| [0202 数据模型与存储设计](docs/02-design/0202-数据模型与存储设计.md) | SQLite DDL（source/chunk/entity/relation/mention/community/quarantine/FTS5）；GraphStore 接口；迁移；容量与性能预算；存储面安全 |
| [0203 核心引擎管线设计](docs/02-design/0203-核心引擎管线设计.md) | ingest 七阶段状态机（授权→扫描→分块→抽取→归并→LPA→摘要）；三模式查询管线；并发一致性；成本模型 |
| [0204 Agent 工具契约设计](docs/02-design/0204-Agent工具契约设计.md) | 五工具（query/graph/status/index/forget）参数与输出契约；EvidencePack 分级证据；审批门；能力公告；错误码表 |
| [0205 双引擎适配与分发设计](docs/02-design/0205-双引擎适配与分发设计.md) | 适配层收敛点；package.json 双引擎字段；cordis.patch.yml 角色行；构建/测试/发版流水线；配置面 v1 |
| [0206 评测体系设计](docs/02-design/0206-评测体系设计.md) | 冻结评测集（40 题 + 双 fixture 语料 + LLM 录制回放）；基线与门槛规则；回归门；防过拟合纪律 |

### 第三批 · 实施计划（03-plan）

| 文档 | 内容 |
|---|---|
| [0301 实施计划](docs/03-plan/0301-实施计划.md) | M1 核心引擎与评测基线 → M2 插件壳与 dsh 落地 → M3 QiLin 通道与打磨；任务分解（含估时与验收）；风险登记册；立即行动项 |

## 一页纸摘要

- **定位**：填补 dsh 生态空白——"文档语料 GraphRAG + agent 工具化 + 双引擎"无人覆盖（0101 §4）。
- **架构**：三角色（`ctx.graphrag` seam + 本地引擎 provider + 工具 consumer），核心库零宿主依赖（0201）。
- **工具面**：`graphrag_query`（local/global）、`graphrag_graph`（多跳遍历）、`graphrag_status`、`graphrag_index` / `graphrag_forget`（审批门）（0204）。
- **铁律**：图谱导航、原文举证；评测先行（M1 第一周冻结 40 题）；复杂度只有赢过 BM25 基线才进主干。
- **双引擎**：零 `@deepseek-ai/*` 运行时导入 + d.ts 垫片 + peerDeps `*` + 单产物双 bundle（0103/0205）。

## License

MIT（随骨架落地，见 M1-W0）。
