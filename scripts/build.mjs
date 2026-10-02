/** esbuild 双 bundle 构建（docs/02-design/0205 §4）：三入口 → lib/，产物提交进仓
 * （安装期零构建）。external：宿主 peer（@deepseek-ai/*）+ 运行时依赖 zod。
 * dts 不生成（消费者是宿主运行时；类型面由 src/types/dsh.d.ts 服务）。
 */
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outdir = join(root, 'lib')

rmSync(outdir, { recursive: true, force: true })
mkdirSync(outdir, { recursive: true })

const common = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  external: ['@deepseek-ai/*', 'zod'],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
}

const entries = [
  { in: join(root, 'src/index.ts'), out: join(outdir, 'index') },
  { in: join(root, 'src/provider.ts'), out: join(outdir, 'provider') },
  { in: join(root, 'src/tool.ts'), out: join(outdir, 'tool') },
  { in: join(root, 'src/rpc.ts'), out: join(outdir, 'rpc') },
]

for (const entry of entries) {
  await build({ ...common, entryPoints: [entry.in], outfile: `${entry.out}.js` })
  console.log(`built ${entry.out}.js`)
}

// 补充产物：cordis.patch.yml 已在 files 列表；无需复制
console.log('build done')

// ── web client bundle（0207 §3：client 模块表契约）──────────────────────────
const PACKAGE_ID = 'dsh-kylin-vibe'
await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: 'lib/client.js',
  sourcemap: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: {
    js: [
      `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
      'var module = { exports: {} }; var exports = module.exports;',
      // 平台单例模块表的 require 存进 bundle 内变量：运行时软取宿主能力
      // （如 ui-primitives 的 MarkdownText），缺席宿主回落自有渲染。
      'var __bundleRequire = typeof require === "function" ? require : undefined;',
    ].join('\n'),
  },
  footer: { js: 'return module.exports; } });' },
})
console.log('built lib/client.js')
