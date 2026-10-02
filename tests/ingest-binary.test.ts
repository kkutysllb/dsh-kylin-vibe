import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { strToU8, zipSync } from 'fflate'

import { runIngest, type CommunitySummarizer } from '../src/core/ingest.ts'
import { SqliteGraphStore } from '../src/core/graphstore.ts'
import type { LlmCompleter, VisionCompleter } from '../src/core/extractor.ts'

/** 复用 core-ingest 的 oracle 约定：chunk 文本含已知实体名即抽取。 */
const KNOWN = ['甲服务', '乙服务']
function oracleJson(text: string): string {
  const found = KNOWN.filter(n => text.includes(n))
  return JSON.stringify({
    entities: found.map(n => ({ n, t: 'module', d: null, c: 0.8 })),
    relations: found.length >= 2 ? [{ s: found[0], r: 'uses', o: found[1], d: null, c: 0.8 }] : [],
  })
}
function oracleLlm(calls: { n: number }): LlmCompleter {
  return { complete: async (_sys, user) => { calls.n++; return oracleJson(user) } }
}
const summarize: CommunitySummarizer = async input => `社区：${input.members.map(m => m.name).join('、')}`

function docxOf(paragraphs: readonly string[]): Uint8Array {
  const body = paragraphs.map(p => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  return zipSync({ 'word/document.xml': strToU8(xml) })
}

let dir: string
let store: SqliteGraphStore

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'graphrag-ingest-bin-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  mkdirSync(join(dir, 'img'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'sample.docx'), docxOf(['甲服务使用乙服务完成编排。', '乙服务依赖存储层。']))
  writeFileSync(join(dir, 'docs', 'old.doc'), Buffer.from([0xd0, 0xcf, 0x11, 0xe0])) // OLE 魔数
  writeFileSync(join(dir, 'img', 'diagram.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3])) // PNG 魔数
  writeFileSync(join(dir, 'app.exe'), Buffer.from([0x4d, 0x5a, 0, 0, 1])) // MZ + NUL
  writeFileSync(join(dir, 'readme.md'), '普通文本：甲服务在此。\n')
  mkdirSync(join(dir, 'state'), { recursive: true })
  store = new SqliteGraphStore(join(dir, 'state', 'g.db'))
})

after(() => {
  store.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('ingest 扩展名路由（二进制文档/图片/旧格式）', () => {
  test('第一轮（无 vision）：docx 抽取合并，旧格式/图片/二进制各归其位', async () => {
    const calls = { n: 0 }
    const report = await runIngest(store, {
      authorizedRoots: [dir],
      extract: { minConfidence: 0.6, repairRetries: 0 },
    }, { llm: oracleLlm(calls), summarize })

    // docx 走抽取管线（2 chunk 以内）；md 正常
    assert.equal(store.listSources().find(s => s.path === 'docs/sample.docx')?.state, 'merged')
    assert.equal(store.listSources().find(s => s.path === 'readme.md')?.state, 'merged')

    const docxChunks = store.getChunks(store.listSources().find(s => s.path === 'docs/sample.docx')!.id)
    assert.ok(docxChunks.some(c => c.text.includes('甲服务使用乙服务')), 'chunk 应为抽取文本')

    // 实体入图
    assert.ok(store.listSources().filter(s => s.state === 'merged').length >= 2)

    // 旧格式：failed + legacy-binary 理由
    const old = store.listSources().find(s => s.path === 'docs/old.doc')
    assert.equal(old?.state, 'failed')

    // 图片：vision 缺席 → failed/vision-unavailable
    const img = store.listSources().find(s => s.path === 'img/diagram.png')
    assert.equal(img?.state, 'failed')

    // exe：NUL 启发 → skipped-binary
    assert.equal(store.listSources().find(s => s.path === 'app.exe')?.state, 'failed')

    assert.ok(report.files.skipped >= 3, `旧格式+图片+二进制计入 skipped（实际 ${report.files.skipped}）`)
  })

  test('第二轮（注入 vision）：图片走视觉抽取合并入图', async () => {
    const vision: VisionCompleter = {
      async save() { return { refId: 1 } },
      async complete() {
        return JSON.stringify({
          entities: [
            { n: '图中网管中心', t: 'module', d: '组织节点', c: 0.8 },
            { n: '能力画像', t: 'concept', d: '画像体系', c: 0.8 },
          ],
          relations: [{ s: '图中网管中心', r: 'defines', o: '能力画像', d: null, c: 0.8 }],
        })
      },
    }
    const report = await runIngest(store, {
      authorizedRoots: [dir],
      extract: { minConfidence: 0.6, repairRetries: 0 },
    }, { llm: oracleLlm({ n: 0 }), summarize, vision })

    const img = store.listSources().find(s => s.path === 'img/diagram.png')
    assert.equal(img?.state, 'merged')

    // 合成正文 chunk + 实体/关系入图
    const chunks = store.getChunks(img!.id)
    assert.ok(chunks.length >= 1)
    assert.ok(chunks.some(c => c.text.includes('图中网管中心') && c.text.includes('—defines→')))
    assert.ok(report.graphDelta.entitiesAdded >= 0)

    // 实体真正入图
    assert.ok(store.allEntities().some(e => e.name === '图中网管中心'))
    assert.ok(store.allEntities().some(e => e.name === '能力画像'))
  })
})
