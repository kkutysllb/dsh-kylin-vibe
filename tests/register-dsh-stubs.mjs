/** 宿主服务最小桩（M1 版）。
 *
 * 让全部测试不依赖宿主 checkout（docs/02-design/0205 §5）。M1 核心库
 * 测试尚不触碰宿主面，此文件只占位保证 `--import` 链可用；M2 起
 * 在此注入 tools / llm / systemPrompt / storageDomain 桩。
 */

// 有意留空：M1 的核心测试不解析任何 @deepseek-ai/* 模块。
