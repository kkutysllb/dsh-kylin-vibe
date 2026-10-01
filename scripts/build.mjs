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
]

for (const entry of entries) {
  await build({ ...common, entryPoints: [entry.in], outfile: `${entry.out}.js` })
  console.log(`built ${entry.out}.js`)
}

// 补充产物：cordis.patch.yml 已在 files 列表；无需复制
console.log('build done')
