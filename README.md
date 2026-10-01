# dsh-kylin-vibe

**dsh-kylin-vibe**：DeepSeek Harness（dsh）与 QiLin（麒麟）双引擎的 GraphRAG 插件。把显式授权的本地语料（代码/文档）增量索引成知识图谱（实体-关系-社区），以 agent 工具形式暴露，供模型在任务执行中做关系性/全局性推理检索。

当前状态：**v0.1.0 已发布**（2026-10-02，108/108 测试）——GraphRAG 核心引擎（local/global/traversal 三模式）+ agent 五工具（审批门 + 多库选择）+ 双语 Web 面板（建库 / 索引进度 / 图谱浏览 / 准确性抽查 / 体检报告）；dsh 0.2.0-rc.2 与 QiLin 3.0.7 双引擎真实宿主验证。发布说明见 [release/v0.1.0](release/v0.1.0.md)，开发历程见 [实施计划](docs/03-plan/0301-实施计划.md)。

## 用户指南

**安装**（重启 `dsh web` / KCoder / QiLin 生效）：

```sh
dsh plugin --profile web add dsh-kylin-vibe        # npm registry（推荐）
dsh plugin --profile web add github:kkutysllb/dsh-kylin-vibe#v0.1.0   # GitHub 直装
qilin plugin --profile <name> add dsh-kylin-vibe   # QiLin 通道（需 3.0.0+）
```

**用起来**（三条入口）：

1. **构建知识库**：侧边栏「知识图谱」打开面板 → 新建知识库（名称 + 授权目录绝对路径）→ 点「索引」，进度实时可见；agent 侧也可直接调 `graphrag_index`（需审批）。
2. **任务使用图谱**：agent 执行任务时自动可调 `graphrag_query`（local/global 检索）、`graphrag_graph`（多跳遍历）、`graphrag_status`；多库用 `kb` 参数指定，不指定时按工作区路径/唯一库自动解析。
3. **验证准确性**：面板「浏览 / 审查」查看实体与邻居关系及原文引用；「准确性抽查」对低置信关系人工判定（标记"错误"的关系检索期自动排除）；「体检报告」看覆盖率与抽样精确率。

界面语言跟随引擎设置自动切换（中文/English）。

开发速览：

```sh
pnpm install          # autoInstallPeers=false（宿主 peer 由宿主注入）
pnpm check            # typecheck + 108 测试 + 五 bundle 构建 + smoke
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
