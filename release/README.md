# 版本发布说明 / Release Notes

本目录是 dsh-kylin-vibe 的版本发布事实源：每个发布版本一份
`v<semver>.md`，与 git tag 一一对应。`package.json` 的 `version` 是 KCoder
插件管理检测新版本的信号——**每次发布必须 bump 版本号**；检测到新版本后由
用户手动更新。

## 版本索引

| 版本 | 日期 | 说明 |
|---|---|---|
| [v0.1.0](v0.1.0.md) | 2026-10-02 | 首个发布：GraphRAG 核心引擎（local/global/traversal 三模式检索）+ agent 五工具（审批门）+ 双语 Web 面板（建库/索引/浏览/准确性抽查/体检报告）+ dsh/QiLin 双引擎验证 |

## 发版约定

每个版本说明固定以下章节（缺项写「无」）：

1. **版本信息**：版本号 / 日期 / tag / 功能提交 / 发布渠道
2. **新增**：新功能、新文件、新渠道
3. **变更**：行为、默认值、文档、元数据的改动
4. **修复**：缺陷修复（写清症状 → 根因 → 修后行为）
5. **删除**：移除的功能、文件、渠道
6. **兼容性与升级说明**：接口契约、配置语义的变化；升级方式
7. **验证**：本版本实际跑过的验证与结果

## 发版 checklist

1. `package.json` bump `version`（semver：修复 → patch，功能 → minor，破坏性 → major）
2. `pnpm check` 全绿（typecheck + 用例 + 五 bundle 构建 + 冒烟）
3. 写 `release/vX.Y.Z.md`（对照上述章节）
4. 提交并打 tag：`git tag -a vX.Y.Z -m "..."`
5. 推送（含 tag）：`git push origin main --tags`
6. npm 渠道（主渠道，版本可被插件管理检测）——**由维护者手动执行**：
   ```sh
   npm whoami            # 首次：npm login
   npm publish           # prepack 自动跑 check
   # 首发显式 --access public 可省（package.json publishConfig 已声明）
   ```
   发布后确认 npmmirror 同步：`npm view dsh-kylin-vibe version`（同步通常 10 分钟内）
7. GitHub Release 页面：`node scripts/create-github-releases.mjs`
   （把 `release/vX.Y.Z.md` 发布为对应 tag 的 Release 页面；幂等可重跑；需 gh CLI 已登录）
8. 镜像仓对账：`node scripts/sync-to-dsh-plugins.mjs && cd ../dsh-plugins && git add -A && git commit -m "sync dsh-kylin-vibe vX.Y.Z" && git push`
   再回本仓 `node scripts/sync-to-dsh-plugins.mjs --check` 零差异
9. 双入口对账：npm / GitHub / dsh-plugins 三个安装源包内容一致（files 白名单 + `package.json` 为准）
   ——**镜像目录必须含 `package.json`**：`files` 里从不写它（npm 打包自动带上），
   但镜像目录是按路径安装的，缺 manifest 时 pnpm 会装成 0.0.0 空壳、插件加载不起来
   （automation v0.3.1 同款教训）。装完可验：`pnpm add <镜像目录>` 后
   `node_modules/dsh-kylin-vibe/package.json` 存在且 `dsh.bundle.patch` / `exports` 齐全。

## 双引擎发版检查单（v0.1.0 实测基线）

| 检查项 | dsh | QiLin |
|---|---|---|
| manifest 通道 | `dsh.bundle.patch` / `dsh.client` | `qilin.bundle.patch` / `qilin.client`（同一份产物） |
| 工具面（只读三工具往返 + 证据引用） | ✅ p0headless headless agent | ✅ QiLin 3.0.7 `--profile <p> headless` |
| 审批 fail-closed（headless 自动拒绝写操作） | ✅ | ✅ |
| Web 面板（建库/索引/浏览/抽查） | ✅ 真实宿主浏览器 | 面板 client 面未逐一评估（同 bundle 交付） |
| 面板双语自适应 | ✅ 引擎语言切换实测 | 同 bundle（locale 服务同源） |

QiLin 侧冒烟要点（复现）：插件须装进 **profile 私有**
`~/.qilin/profiles/<name>/node_modules`（共享 `profiles/node_modules` 为安装
保留区，bundle 层包放那里激活直接失败）；运行需 QiLin 3.0.0+（dsh 兼容层）。
headless 冒烟：`qilin --profile <p> headless "…调用 graphrag_status / graphrag_query…"`
——**必须显式 `--profile`**，裸 `headless` 启动的是缺省 headless profile（无本插件）。

## 安装渠道

```sh
# npm registry（推荐：版本检测 + 手动更新）
dsh plugin --profile web add dsh-kylin-vibe
qilin plugin --profile <name> add dsh-kylin-vibe

# GitHub 直装
dsh plugin --profile web add github:kkutysllb/dsh-kylin-vibe#v0.1.0
qilin plugin --profile <name> add github:kkutysllb/dsh-kylin-vibe#v0.1.0

# dsh-plugins 镜像仓子目录（pnpm 路径安装）
git clone git@github.com:kkutysllb/dsh-plugins.git
dsh plugin --profile web add ./dsh-plugins/dsh-kylin-vibe
```

安装后重启 `dsh web`（或 KCoder / QiLin）生效。
