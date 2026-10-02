import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'

import { strToU8, zipSync } from 'fflate'

import { extractDocText } from '../src/core/extract-doc.ts'
import { extractImage, type VisionCompleter } from '../src/core/extractor.ts'

// ── fixture 构造（程序化生成，零网络/零二进制资源文件）──────────────────────

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'

function docxOf(paragraphs: readonly string[]): Uint8Array {
  const body = paragraphs.map(p => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W_NS}><w:body>${body}</w:body></w:document>`
  return zipSync({ 'word/document.xml': strToU8(xml) })
}

function pptxOf(slides: readonly (readonly string[])[]): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  slides.forEach((paras, i) => {
    const body = paras.map(t => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join('')
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ${A_NS}><p:txBody>${body}</p:txBody></p:sld>`,
    )
  })
  return zipSync(files)
}

function xlsxOf(shared: readonly string[], rows: string): Uint8Array {
  const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst ${'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'} count="${shared.length}" uniqueCount="${shared.length}">${shared.map(t => `<si><t>${t}</t></si>`).join('')}</sst>`
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
  return zipSync({
    'xl/sharedStrings.xml': strToU8(sst),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  })
}

function minimalPdf(text: string): Uint8Array {
  const content = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`
  const objs = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const o of objs) {
    offsets.push(pdf.length)
    pdf += `${o}\n`
  }
  const xrefAt = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`
  return strToU8(pdf)
}

async function extractTmp(name: string, bytes: Uint8Array): Promise<ReturnType<typeof extractDocText>> {
  const path = join(tmpdir(), `graphrag-extract-test-${name}`)
  writeFileSync(path, bytes)
  try {
    return await extractDocText(path, bytes.length)
  } finally {
    // 留给 OS 清理亦可；测试目录用后即删
    const { unlinkSync } = await import('node:fs')
    try { unlinkSync(path) } catch { /* ignore */ }
  }
}

// ── 用例 ─────────────────────────────────────────────────────────────────────

describe('extract-doc 二进制文档文本抽取', () => {
  test('docx：段落提取 + XML 实体解码', async () => {
    const r = await extractTmp('t.docx', docxOf(['甲服务使用乙服务', 'A &amp; B 部署于乙服务']))
    assert.equal(r.kind, 'text')
    if (r.kind !== 'text') return
    assert.ok(r.text.includes('甲服务使用乙服务'))
    assert.ok(r.text.includes('A & B 部署于乙服务'), '实体应解码为 &')
    assert.ok(!r.text.includes('&amp;'))
  })

  test('pptx：按页分组（幻灯片标记）', async () => {
    const r = await extractTmp('t.pptx', pptxOf([['第一页：甲服务'], ['第二页：乙服务', '要点乙']]))
    assert.equal(r.kind, 'text')
    if (r.kind !== 'text') return
    assert.ok(r.text.includes('[幻灯片 1]'))
    assert.ok(r.text.includes('[幻灯片 2]'))
    assert.ok(r.text.indexOf('[幻灯片 1]') < r.text.indexOf('[幻灯片 2]'))
    assert.ok(r.text.includes('第二页：乙服务'))
  })

  test('xlsx：共享字符串 + 内联 + 裸值行列重建', async () => {
    const rows = [
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
      '<row r="2"><c r="A2"><v>42</v></c><c r="B2" t="inlineStr"><is><t>直接内联</t></is></c></row>',
    ].join('')
    const r = await extractTmp('t.xlsx', xlsxOf(['甲服务', '乙服务'], rows))
    assert.equal(r.kind, 'text')
    if (r.kind !== 'text') return
    assert.ok(r.text.includes('甲服务 | 乙服务'))
    assert.ok(r.text.includes('42 | 直接内联'))
  })

  test('pdf：文本层提取', async () => {
    const r = await extractTmp('t.pdf', minimalPdf('Hello AIDC'))
    assert.equal(r.kind, 'text')
    if (r.kind !== 'text') return
    assert.ok(r.text.includes('Hello AIDC'))
  })

  test('旧格式 .doc 明确不支持（报因而非笼统 skipped-binary）', async () => {
    const r = await extractTmp('t.doc', strToU8('whatever'))
    assert.equal(r.kind, 'unsupported')
    if (r.kind !== 'unsupported') return
    assert.ok(r.reason.includes('legacy-binary'))
  })

  test('损坏的 docx（缺主部件）报 parse-failed 语义', async () => {
    const r = await extractTmp('broken.docx', zipSync({ 'xl/other.xml': strToU8('<x/>') }))
    assert.equal(r.kind, 'failed')
    if (r.kind !== 'failed') return
    assert.ok(r.reason.includes('docx'))
  })
})

// ── extractImage（视觉抽取编排）─────────────────────────────────────────────

function fakeVision(responses: readonly string[], opts: { saveThrows?: boolean } = {}): VisionCompleter & { readonly saved: readonly unknown[] } {
  const saved: unknown[] = []
  let call = 0
  return {
    saved,
    async save(input) {
      if (opts.saveThrows === true) throw new Error('attachment service missing')
      saved.push(input)
      return { refId: saved.length }
    },
    async complete(_system, _user, _ref) {
      const r = responses[Math.min(call, responses.length - 1)]
      call++
      return r ?? ''
    },
  }
}

describe('extract-image 视觉抽取编排', () => {
  const IMAGE = { data: new Uint8Array([1, 2, 3]), mime: 'image/png', name: 'd.png' }
  const GOOD = JSON.stringify({
    entities: [{ n: '网管中心', t: 'module', d: '组织', c: 0.8 }],
    relations: [{ s: '网管中心', r: 'defines', o: '能力画像', d: null, c: 0.8 }],
  })

  test('正常路径：save+complete → 解析成功', async () => {
    const v = fakeVision([GOOD])
    const r = await extractImage(v, IMAGE, 'img/d.png')
    assert.equal(r.ok, true)
    assert.equal(v.saved.length, 1)
    if (r.ok) {
      assert.equal(r.items.entities.length, 1)
      assert.equal(r.items.relations.length, 1)
    }
    assert.equal(r.llmCalls, 1)
  })

  test('解析失败重试：第一次坏 JSON，第二次好 JSON', async () => {
    const v = fakeVision(['不是 JSON', GOOD])
    const r = await extractImage(v, IMAGE, 'img/d.png')
    assert.equal(r.ok, true)
    assert.equal(r.llmCalls, 2)
  })

  test('save 抛错 → LLM_ERROR（不调用 complete）', async () => {
    const v = fakeVision([GOOD], { saveThrows: true })
    const r = await extractImage(v, IMAGE, 'img/d.png')
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.errorCode, 'LLM_ERROR')
      assert.ok(r.detail.includes('attachment'))
    }
    assert.equal(r.llmCalls, 0)
  })

  test('合法空抽取 → EMPTY（合法无内容）', async () => {
    const v = fakeVision([JSON.stringify({ entities: [], relations: [] })])
    const r = await extractImage(v, IMAGE, 'img/d.png')
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.errorCode, 'EMPTY')
  })
})
