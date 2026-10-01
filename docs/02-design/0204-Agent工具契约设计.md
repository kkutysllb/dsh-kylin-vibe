# 0204 · Agent 工具契约设计

- 日期：2026-10-01
- 状态：定稿（实施基准）
- 上游依据：0201（架构）、0203（管线）、0103（宿主工具契约）、ADR-8/9

## 1. 工具面总览

五个模型可调用工具，命名前缀 `graphrag_`。挂载策略：注册到根 agent 的 scoped tool runtime（学 automation 的 scoped 挂载，未挂载的 agent 不可见）。

| 工具 | 类型 | LLM 成本 | 审批门 |
|---|---|---|---|
| `graphrag_query` | 读 | local/traverse 零；global 有打分调用 | 无 |
| `graphrag_graph` | 读 | 零 | 无 |
| `graphrag_status` | 读 | 零 | 无 |
| `graphrag_index` | 写 | 有（抽取+摘要） | **有**（成本公示） |
| `graphrag_forget` | 写（销毁） | 无 | **有** |

## 2. 各工具契约

### 2.1 `graphrag_query` —— 推理检索主入口

```jsonc
{
  "name": "graphrag_query",
  "description": "在已索引的工作区知识图谱上检索证据。关系性问题（X 如何影响 Y、X 与 Y 的关联）用 mode=local；全局性问题（整体架构、主要模块划分、设计思路）用 mode=global。",
  "parameters": {
    "type": "object",
    "properties": {
      "question": { "type": "string", "description": "自然语言问题（≤500 字）" },
      "mode": { "type": "string", "enum": ["local", "global"], "description": "缺省 local" },
      "maxTokens": { "type": "number", "description": "证据包 token 预算，缺省 6000，上限 12000" }
    },
    "required": ["question"]
  }
}
```

**输出（EvidencePack）**——分级呈现"结构理解"与"原文证据"：

```jsonc
{
  "mode": "local",
  "question": "...",
  "entities": [            // 结构理解层（二手信息，标注来源）
    { "name": "SessionStore", "type": "class", "description": "...", "community": "会话持久化" }
  ],
  "relations": [
    { "s": "AgentLoop", "r": "uses", "o": "SessionStore", "w": 7,
      "evidence": [{ "path": "src/loop.ts", "lines": "120-134" }] }
  ],
  "chunks": [              // ★ 原文证据层（一级证据，精确行列号）
    { "path": "src/store.ts", "lines": "45-67", "text": "..." }
  ],
  "communities": [         // 社区摘要层（二手信息，显式标记）
    { "summary": "该社区负责...", "note": "LLM 生成摘要，引用需回到 chunks", "top": ["..."] }
  ],
  "meta": { "seedHits": 5, "pprIterations": 14, "llmCalls": 0, "coverage": "indexed 2026-10-01, 1234 files" }
}
```

`render`：`text` = 上述 JSON 的紧凑呈现（学 automation 的 bounded summary 风格，chunks 截断到预算）；`output.schema` = zod 推导的 JSON Schema。

### 2.2 `graphrag_graph` —— 图遍历（影响分析）

```jsonc
{
  "name": "graphrag_graph",
  "description": "从实体出发做多跳图遍历，用于影响面分析、调用链追踪。不调用 LLM，返回结构化子图。",
  "parameters": {
    "type": "object",
    "properties": {
      "seed": { "type": "string", "description": "实体名或别名" },
      "direction": { "type": "string", "enum": ["out", "in", "both"], "description": "in = 反向影响（谁依赖它）；缺省 both" },
      "hops": { "type": "number", "description": "1..4，缺省 2" },
      "relationTypes": { "type": "array", "items": { "type": "string" }, "description": "过滤边类型，如 [\"calls\",\"imports\"]" },
      "maxNodes": { "type": "number", "description": "缺省 200，上限 500" }
    },
    "required": ["seed"]
  }
}
```

输出 `Subgraph`：`nodes`（实体卡，带 degree）/ `edges`（每边 1 条 mention 引用）/ `truncated: bool` / `ambiguousSeeds?`（seed 多命中时返回候选列表让 agent 复调）。

### 2.3 `graphrag_status` —— 状态与健康

```jsonc
{
  "name": "graphrag_status",
  "description": "查看知识图谱索引状态：覆盖文件数、实体/关系/社区规模、最后索引时间、陈旧度、隔离区计数。回答'图谱能不能信'的问题。",
  "parameters": { "type": "object", "properties": {} }
}
```

输出 `IndexStatus`：`files`（indexed/stale/quarantined/skipped-binary 计数）、`graph`（entities/relations/communities）、`lastIndexAt`、`staleness`（自上次索引以来的文件变更估计）、`provider`（id + 健康）、`pendingApproval?`。agent 判断"图谱太旧先 re-index"依赖此工具。

### 2.4 `graphrag_index` —— 建图/增量更新（审批门）

```jsonc
{
  "name": "graphrag_index",
  "description": "索引授权目录（或显式指定的已授权子路径）：分块→LLM 实体关系抽取→社区摘要。增量执行，仅处理变更文件。触发 LLM 调用，成本随变更量线性。",
  "parameters": {
    "type": "object",
    "properties": {
      "roots": { "type": "array", "items": { "type": "string" }, "description": "可选：本次索引的已授权子路径；缺省用配置 roots" },
      "retryQuarantined": { "type": "boolean", "description": "同时重放隔离区，缺省 false" }
    }
  }
}
```

输出 `IndexReport`：`files`（new/changed/deleted/skipped）、`graph delta`（+实体/+边/社区重算数）、`cost`（llm_calls / tokens_in / tokens_out）、`quarantined` 计数、`aborted?`（含可续跑说明）。执行前先做 dry-run 估算并进审批卡。

### 2.5 `graphrag_forget` —— 遗忘（审批门）

```jsonc
{
  "name": "graphrag_forget",
  "description": "从图谱移除数据：指定文件、指定实体、或整图重置。销毁性操作，级联删除关联 chunk/关系/摘要。",
  "parameters": {
    "type": "object",
    "properties": {
      "target": {
        "oneOf": [
          { "type": "object", "properties": { "kind": { "const": "file" }, "path": { "type": "string" } }, "required": ["kind", "path"] },
          { "type": "object", "properties": { "kind": { "const": "entity" }, "name": { "type": "string" } }, "required": ["kind", "name"] },
          { "type": "object", "properties": { "kind": { "const": "graph" } }, "required": ["kind"] }
        ]
      }
    },
    "required": ["target"]
  }
}
```

输出 `ForgetReport`：删除计数（chunk/mention/relation/实体/摘要）与社区重算说明。

## 3. 审批门设计（`tools/pre-execute` 挂钩）

挂载在 agent 的 scoped context 上，仅对挂载 agent 的 `graphrag_index` / `graphrag_forget` 生效（学 automation 的 `needsHumanApproval` 边界：非挂载 agent、已 abort 的 signal 直接放行到拒绝路径）。

`ask` 决策双字段（0.1.7 契约，旧宿主回落 `reason`）：

| 工具 | `reason`（审计文案，locale 无关） | `displayReason`（本地化） |
|---|---|---|
| `graphrag_index` | `graphrag_index: ~{estCalls} LLM calls over {files} files` | `即将执行图谱索引：约 {estCalls} 次 LLM 调用，涉及 {files} 个文件（{bytes}）。继续？` / en |
| `graphrag_forget` | `graphrag_forget: destroy {kind} {name}` | `即将从图谱移除 {描述}，级联删除关联数据。继续？` / en |

估算来源：dry-run 的 `diffDirty` 结果 × 0203 成本模型。

## 4. 能力公告段（systemPrompt 注入）

≤ 400 字，风格对齐 automation 公告（工具名册 + 非显然约束）：

```text
【知识图谱检索】本工作区可经 GraphRAG 工具做结构化推理检索：
- 全局性/架构性问题（整体设计、模块划分）→ graphrag_query mode=global
- 关系性问题（X 如何影响 Y、关联路径）→ graphrag_query mode=local 或 graphrag_graph 遍历
- 精确文本搜索仍用 grep/glob；图谱覆盖范围与新鲜度先看 graphrag_status
约束：1) 引用结论必须落到返回的 chunks 原文（path+lines），社区摘要仅供参考；
2) 图谱陈旧（status 显示大量 stale）时先 graphrag_index 增量更新；
3) 索引会产生 LLM 调用成本，需用户审批。
```

## 5. 错误码与模型可读文案

| 码 | 场景 | 模型看到的短文案 |
|---|---|---|
| `NOT_AUTHORIZED` | root 未在授权配置内 | 该路径未被授权索引；请让用户在配置中添加 roots |
| `NOT_INDEXED` | 查询时无索引 | 工作区尚未建立图谱；先调用 graphrag_index（需审批） |
| `INDEX_IN_PROGRESS` | 并发索引 | 索引进行中（{progress}），稍后重试或读 graphrag_status |
| `NO_SEED` | local 查询无种子命中 | 词法未命中实体；换表述或先用 grep 定位实体名 |
| `AMBIGUOUS_SEED` | traversal 多命中 | 候选：[...]；用更精确的名称重调 |
| `QUARANTINED` | 隔离区有未处理数据 | {n} 个 chunk 抽取失败被隔离；可用 graphrag_index retryQuarantined 重放 |
| `NO_PROVIDER` / `MISSING_CREDENTIAL` | llm 面不可用 | 宿主未配置模型 provider；索引/摘要不可用，词法检索与遍历不受影响 |
| `ABORTED` | 审批拒绝/取消 | 已中止；进度已存档，可再次 graphrag_index 续跑 |

审计层保留码 + 上下文；模型层只透出短文案（学 llm 的"按码路由不按文本"纪律）。

## 6. 工具描述瘦身对齐

0.1.7 宿主对工具描述做了瘦身（参数级规则收进参数描述，见 0103 §3.4），本契约已遵循：`description` 只说"做什么 + 何时用"，规则放参数 `description`（如 `mode` 的选择指引、`hops` 的范围）。
