/** 浏览与审查视图（0207 §3.3/§3.4）：实体浏览 + 抽样审查 + 体检报告。
 * 数据经 runtime.rpc 直连主机通道；组件保持无状态拉取-渲染。
 * 证据原文是 markdown 源（md 语料）：经平台单例模块表软取宿主
 * ui-primitives 的 MarkdownText 渲染；缺席宿主回落 <pre> 原文。
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { unwrap, type EntityCard, type HealthReport, type ReviewSample } from './protocol.ts'
import type { KbRuntime, Translate } from './runtime.ts'
import { RPC_CHANNEL } from './runtime.ts'
import { formatTime } from './view.tsx'

/** 平台单例模块表的 require（build.mjs 包装器注入；测试/裸环境 undefined）。 */
declare const __bundleRequire: ((spec: string) => unknown) | undefined

type MarkdownTextProps = {
  text: string
  labels: { code: { copyLabel: string; copiedLabel: string }; footnotes: string }
  variant?: 'body' | 'compact'
}

/** memo() 组件是带 $$typeof 的对象而非函数——两种形态都收。 */
type MarkdownTextFace = React.ComponentType<MarkdownTextProps>

let markdownTextCache: MarkdownTextFace | undefined | null = null

/** 软取宿主 MarkdownText（只找一次）；任何失败回落 undefined。 */
function markdownTextOf(): MarkdownTextFace | undefined {
  if (markdownTextCache !== null) return markdownTextCache
  try {
    const mod = (typeof __bundleRequire === 'function'
      ? __bundleRequire('@deepseek-ai/dsh-client-ui-primitives') as { MarkdownText?: MarkdownTextFace } | undefined
      : undefined)
    const mt = mod?.MarkdownText
    markdownTextCache = mt !== null && mt !== undefined && (typeof mt === 'function' || typeof mt === 'object')
      ? mt
      : undefined
  } catch {
    markdownTextCache = undefined
  }
  return markdownTextCache
}

/** 证据原文渲染：宿主 MarkdownText 在场即渲染 markdown（表格/加粗/标题），
 * 否则 <pre> 原文。max-height 内滚，避免长 chunk 撑爆卡片。 */
function ChunkText(props: { readonly text: string; readonly t: Translate }): React.ReactElement {
  const Markdown = markdownTextOf()
  if (Markdown === undefined) return <pre className='gv-pre'>{props.text}</pre>
  return (
    <div className='gv-pre gv-md'>
      <Markdown
        text={props.text}
        labels={{ code: { copyLabel: props.t('mdCopy'), copiedLabel: props.t('mdCopied') }, footnotes: props.t('mdFootnotes') }}
        variant='compact'
      />
    </div>
  )
}

type TabKind = 'browse' | 'review' | 'recall' | 'health' | 'manage'

export function BrowseReviewView(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string; readonly roots: readonly string[] }): React.ReactElement {
  const { runtime, t, kbId, roots } = props
  const [tab, setTab] = useState<TabKind>('browse')
  const tabs: { readonly kind: TabKind; readonly label: string }[] = [
    { kind: 'browse', label: t('tabBrowse') },
    { kind: 'review', label: t('tabReview') },
    { kind: 'recall', label: t('tabRecall') },
    { kind: 'health', label: t('tabHealth') },
    { kind: 'manage', label: t('tabManage') },
  ]
  return (
    <div>
      <div className='gv-tabs'>
        {tabs.map(x => (
          <button key={x.kind} className={tab === x.kind ? 'gv-btn gv-tab-active' : 'gv-btn'} onClick={() => setTab(x.kind)}>{x.label}</button>
        ))}
      </div>
      {tab === 'browse' && <BrowseTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'review' && <ReviewTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'recall' && <RecallTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'health' && <HealthTab runtime={runtime} t={t} kbId={kbId} />}
      {tab === 'manage' && <ManageTab runtime={runtime} t={t} kbId={kbId} roots={roots} />}
    </div>
  )
}

/** 召回测试（Dify 同款）：输入问题 → local 检索 → 证据 chunk 带分数呈现。 */
function RecallTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [question, setQuestion] = useState('')
  const [topK, setTopK] = useState(12)
  const [pack, setPack] = useState<{ chunks: ReadonlyArray<{ path: string; lines: string; text: string; score: number | null }>; entities: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = (q: string): void => {
    if (q.trim() === '') return
    setBusy(true)
    setPack(null)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'recall', { id: kbId, question: q.trim(), topK }))
      .then((v) => {
        const pack = v as { chunks?: ReadonlyArray<{ path: string; lines: string; text: string; score: number | null }>; entities?: unknown[] }
        setPack({ chunks: pack.chunks ?? [], entities: pack.entities?.length ?? 0 })
      })
      .catch(err => runtime.pushNotice(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setBusy(false))
  }

  return (
    <div>
      <div className='gv-card'>
        <div className='gv-card-head'><span className='gv-name'>{t('recallTitle')}</span></div>
        <div className='gv-search'>
          <input
            value={question}
            placeholder={t('recallPlaceholder')}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run(question) }}
          />
          <select className='gv-select' style={{ width: 90 }} value={topK} onChange={e => setTopK(Number(e.target.value))}>
            {[5, 10, 12, 20, 30, 50].map(k => <option key={k} value={k}>top {k}</option>)}
          </select>
          <button className='gv-btn gv-btn-primary' disabled={busy || question.trim() === ''} onClick={() => run(question)}>{t('recallRun')}</button>
        </div>
        <div className='gv-cost'>{t('recallHint')}</div>
      </div>
      {busy && <div className='gv-empty'>{t('loading')}</div>}
      {pack !== null && !busy && (
        <>
          <div className='gv-cost' style={{ marginBottom: 6 }}>
            {t('recallSummary', { count: pack.chunks.length, entities: pack.entities })}
          </div>
          {pack.chunks.length === 0 && <div className='gv-empty'>{t('noEntities')}</div>}
          {pack.chunks.map((c, i) => (
            <div key={i} className='gv-card'>
              <div className='gv-card-head'>
                <span className='gv-cost' style={{ wordBreak: 'break-all' }}>{c.path}:{c.lines}</span>
                {c.score !== null && <span className='gv-badge'>{t('recallScore')} {c.score.toFixed(3)}</span>}
              </div>
              <ChunkText text={c.text} t={t} />
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function BrowseTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<readonly EntityCard[]>([])
  const [loading, setLoading] = useState(true)

  const load = (q: string): void => {
    setLoading(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'browse', { id: kbId, query: q, limit: 30 }))
      .then((v) => setCards(v as readonly EntityCard[]))
      .catch(err => runtime.pushNotice(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load('') }, [kbId])

  return (
    <div className='gv-split'>
      <div className='gv-split-left'>
        <div className='gv-search'>
          <input
            value={query}
            placeholder={t('searchPlaceholder')}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(query) }}
          />
          <button className='gv-btn' onClick={() => load(query)}>{t('search')}</button>
        </div>
        {loading && <div className='gv-empty'>{t('loading')}</div>}
        {!loading && cards.length === 0 && <div className='gv-empty'>{t('noEntities')}</div>}
        {cards.map(card => (
          <div key={card.id} id={`gv-card-${card.id}`} className='gv-card'>
            <div className='gv-card-head'>
              <span className='gv-name'>{card.name}</span>
              <span className='gv-badge'>{card.type}</span>
              <span className='gv-badge'>deg {card.degree}</span>
            </div>
            {card.description !== null && card.description !== '' && <div>{card.description}</div>}
            {card.neighbors.length > 0 && (
              <table className='gv-table'>
                <tbody>
                  {card.neighbors.map((nb, i) => (
                    <tr key={i}>
                      <td>{nb.dir === 'out' ? '→' : '←'}</td>
                      <td>{nb.type}</td>
                      <td>{nb.other}</td>
                      <td className='gv-cost'>w={nb.weight}{nb.evidence.length > 0 ? ` · ${nb.evidence[0]?.path}:${nb.evidence[0]?.lines}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
      <div className='gv-split-right'>
        <GraphView t={t} runtime={runtime} kbId={kbId} />
      </div>
    </div>
  )
}

// ── 图谱视图（Neo4j 风格力导向图；数据全部来自真实浏览结果，非示意）────────

const TYPE_COLORS: Record<string, string> = {
  module: '#4b7bec', file: '#a55eea', function: '#26de81', class: '#fd9644',
  type: '#fc5c65', concept: '#45aaf2', config: '#a5b1c2', cli: '#6ab04c',
  api: '#e84393', external_dependency: '#eb3b5a', test: '#2bcbba',
}
function typeColor(t: string): string {
  return TYPE_COLORS[t] ?? '#8892a0'
}

interface GraphNodeData {
  readonly id: number
  readonly key: string
  readonly name: string
  readonly type: string
  readonly degree: number
  readonly isCard: boolean
  x: number
  y: number
}
interface GraphEdgeData {
  readonly key: string
  readonly s: number
  readonly t: number
  readonly type: string
  readonly weight: number
  readonly evidence: string
}

/** 由浏览卡片构建节点/边：实体按 id 去重，关系按无向三元组去重
 * （同一关系会同时出现在两张卡的邻居表里）。 */
/** Fruchterman-Reingold 简化实现：库仑斥力 + 弹簧 + 向心力，退火迭代。
 * seed：已有位置（增量展开时保持现布局）；anchor：未定位新节点的聚拢锚点。 */
function GraphView(props: { readonly t: Translate; readonly runtime: KbRuntime; readonly kbId: string }): React.ReactElement {
  const { t, runtime, kbId } = props
  /** 全量图谱数据（与卡片头统计同源：节点=全部实体，边=全部关系）。 */
  const [data, setData] = useState<{ nodes: { id: number; name: string; type: string; degree: number; x: number; y: number; vx: number; vy: number }[]; edges: { s: number; t: number; type: string; weight: number }[] } | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [egoId, setEgoId] = useState<number | null>(null)
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const dragNode = useRef<number | null>(null)
  const panState = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const alphaRef = useRef(1)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'graphAll', { id: kbId }))
      .then((v) => {
        const r = v as { nodes: { id: number; name: string; type: string; degree: number }[]; edges: { s: number; t: number; type: string; weight: number }[] }
        setData({
          nodes: r.nodes.map(n => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 })),
          edges: r.edges,
        })
        alphaRef.current = 1
      })
      .catch(err => setLoadErr(String(err)))
  }, [kbId])

  // ── Barnes-Hut 力导向（四叉树近似斥力，O(n log n) 扛全量）──
  const layoutStep = (): void => {
    if (data === null) return
    const rect = wrapRef.current?.getBoundingClientRect()
    const W = Math.max(rect?.width ?? 600, 300)
    const H = Math.max(rect?.height ?? 400, 300)
    const nodes = data.nodes
    const n = nodes.length
    if (n === 0) return
    if (alphaRef.current <= 0.012) return
    const k = Math.sqrt((W * H) / n) * 0.9
    // 首帧：环形布点
    if (nodes[0] !== undefined && nodes[0]!.x === 0 && nodes[0]!.y === 0 && nodes[n - 1]!.x === 0 && nodes[n - 1]!.y === 0) {
      nodes.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / n
        node.x = W / 2 + radius0(W, H) * Math.cos(angle)
        node.y = H / 2 + radius0(W, H) * Math.sin(angle)
      })
    }
    const indexBy = new Map<number, number>()
    nodes.forEach((node, i) => indexBy.set(node.id, i))
    // 四叉树
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
    for (const node of nodes) {
      if (node.x < minX) minX = node.x
      if (node.y < minY) minY = node.y
      if (node.x > maxX) maxX = node.x
      if (node.y > maxY) maxY = node.y
    }
    const quad = buildQuad(minX, minY, maxX, maxY)
    for (let i = 0; i < n; i++) quadInsert(quad, nodes[i]!, i)
    const dispX = new Float64Array(n)
    const dispY = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const node = nodes[i]!
      applyBH(quad, node, k, dispX, dispY, i)
    }
    for (const e of data.edges) {
      const ia = indexBy.get(e.s)
      const ib = indexBy.get(e.t)
      if (ia === undefined || ib === undefined) continue
      const a = nodes[ia]!
      const b = nodes[ib]!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = (d * d) / (k * 1.4)
      dispX[ia]! -= (dx / d) * f
      dispY[ia]! -= (dy / d) * f
      dispX[ib]! += (dx / d) * f
      dispY[ib]! += (dy / d) * f
    }
    for (let i = 0; i < n; i++) {
      const node = nodes[i]!
      dispX[i]! -= (node.x - W / 2) * 0.04
      dispY[i]! -= (node.y - H / 2) * 0.04
      const d = Math.max(Math.sqrt(dispX[i]! * dispX[i]! + dispY[i]! * dispY[i]!), 1)
      const limit = Math.min(d, 26) * alphaRef.current
      const dragged = dragNode.current === node.id
      if (!dragged) {
        node.x += (dispX[i]! / d) * limit
        node.y += (dispY[i]! / d) * limit
      }
      node.x = Math.max(14, Math.min(W - 14, node.x))
      node.y = Math.max(14, Math.min(H - 14, node.y))
    }
    alphaRef.current *= 0.992
  }

  // ── 绘制 ──
  const draw = (): void => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (canvas === null || wrap === null || data === null) return
    const rect = wrap.getBoundingClientRect()
    const W = Math.max(rect.width, 300)
    const H = Math.max(rect.height, 300)
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
    }
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    ctx.translate(view.x, view.y)
    ctx.scale(view.k, view.k)
    const ego = egoId
    const egoSet = new Set<number>()
    if (ego !== null) {
      egoSet.add(ego)
      for (const e of data.edges) {
        if (e.s === ego || e.t === ego) { egoSet.add(e.s); egoSet.add(e.t) }
      }
    }
    // 边
    ctx.strokeStyle = 'rgba(120,130,145,0.5)'
    ctx.lineWidth = 1 / view.k
    ctx.beginPath()
    for (const e of data.edges) {
      const a = byIdMap(data.nodes).get(e.s)
      const b = byIdMap(data.nodes).get(e.t)
      if (a === undefined || b === undefined) continue
      if (ego !== null && !egoSet.has(e.s)) continue
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
    ctx.stroke()
    // 箭头（抽样绘制，全部绘制在低缩放时不可辨）
    if (view.k > 0.8) {
      ctx.fillStyle = 'rgba(140,150,165,0.7)'
      for (const e of data.edges) {
        const a = byIdMap(data.nodes).get(e.s)
        const b = byIdMap(data.nodes).get(e.t)
        if (a === undefined || b === undefined) continue
        if (ego !== null && !egoSet.has(e.s)) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const ux = dx / d
        const uy = dy / d
        const rB = nodeR(b)
        const ax = b.x - ux * (rB + 2)
        const ay = b.y - uy * (rB + 2)
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax - ux * 5 - uy * 2.4, ay - uy * 5 + ux * 2.4)
        ctx.lineTo(ax - ux * 5 + uy * 2.4, ay - uy * 5 - ux * 2.4)
        ctx.closePath()
        ctx.fill()
      }
    }
    // 节点（按类型分批填充）
    const byType = new Map<string, number[]>()
    data.nodes.forEach((node, i) => {
      let list = byType.get(node.type)
      if (list === undefined) { list = []; byType.set(node.type, list) }
      list.push(i)
    })
    for (const [type, idxs] of byType) {
      ctx.fillStyle = typeColor(type)
      ctx.beginPath()
      for (const i of idxs) {
        const node = data.nodes[i]!
        if (ego !== null && !egoSet.has(node.id)) continue
        const r = nodeR(node)
        ctx.moveTo(node.x + r, node.y)
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      }
      ctx.fill()
    }
    // 标签（LOD：缩放足够或度数高或悬停/ego 时绘制）
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const labelAlpha = Math.max(0, Math.min(1, (view.k - 0.55) / 0.5))
    for (const node of data.nodes) {
      if (ego !== null && !egoSet.has(node.id)) continue
      const isHot = hoverId === node.id
      const show = isHot || ego === node.id || node.degree >= 8 || labelAlpha > 0.3
      if (!show) continue
      ctx.fillStyle = isHot ? '#ffffff' : 'rgba(215,220,226,0.92)'
      ctx.fillText(node.name.length > 16 ? `${node.name.slice(0, 15)}…` : node.name, node.x, node.y + nodeR(node) + 11)
    }
    ctx.restore()
  }

  // ── 动画循环 ──
  useEffect(() => {
    const tick = (): void => {
      layoutStep()
      draw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  })

  const nodeR = (n: { degree: number }): number => 4 + Math.min(12, Math.sqrt(n.degree) * 1.7)
  function radius0(W: number, H: number): number {
    return Math.min(W, H) * 0.38
  }
  function byIdMap(nodes: readonly { id: number; x: number; y: number }[]): Map<number, { x: number; y: number }> {
    const m = new Map<number, { x: number; y: number }>()
    for (const n of nodes) m.set(n.id, n)
    return m
  }
  function nodeR2(n: { degree: number }): number {
    return nodeR(n)
  }
  // 四叉树实现（模块级函数声明在组件外）

  const toCanvas = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect === undefined || rect === null) return { x: 0, y: 0 }
    return { x: ((clientX - rect.left) - view.x) / view.k, y: ((clientY - rect.top) - view.y) / view.k }
  }

  const pickNode = (cx: number, cy: number): number | null => {
    if (data === null) return null
    let best: number | null = null
    let bestD = Infinity
    for (const node of data.nodes) {
      const dx = node.x - cx
      const dy = node.y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < nodeR(node) + 4 && d < bestD) { best = node.id; bestD = d }
    }
    return best
  }

  const typesUsed = useMemo(() => {
    if (data === null) return []
    const set = new Map<string, number>()
    for (const n of data.nodes) set.set(n.type, (set.get(n.type) ?? 0) + 1)
    return [...set.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  if (loadErr !== null) {
    return <div className='gv-graph'><div className='gv-empty'>{t('loadFailed')}: {loadErr}</div></div>
  }
  if (data === null) {
    return <div className='gv-graph'><div className='gv-empty'>{t('loading')}</div></div>
  }

  return (
    <div className='gv-graph' ref={wrapRef}>
      <div className='gv-graph-head'>
        <span className='gv-name'>{t('graphTitle')}</span>
        <span className='gv-badge'>{t('graphCounts', { nodes: data.nodes.length, edges: data.edges.length })}</span>
        {egoId !== null && <button className='gv-btn' style={{ padding: '1px 8px' }} onClick={() => setEgoId(null)}>{t('graphClearEgo')}</button>}
      </div>
      <div className='gv-legend'>
        {typesUsed.map(([type, count]) => (
          <span key={type} title={type}><i style={{ background: typeColor(type) }} />{type} {count}</span>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        style={{ cursor: hoverId !== null ? 'pointer' : 'grab' }}
        onWheel={e => {
          const factor = e.deltaY > 0 ? 0.9 : 1.1
          setView(v => {
            const k = Math.max(0.08, Math.min(4, v.k * factor))
            const rect = canvasRef.current?.getBoundingClientRect()
            if (rect === undefined || rect === null) return { ...v, k }
            const cx = e.clientX - rect.left
            const cy = e.clientY - rect.top
            return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }
          })
        }}
        onPointerDown={e => {
          const p = toCanvas(e.clientX, e.clientY)
          const hit = pickNode(p.x, p.y)
          if (hit !== null) {
            dragNode.current = hit
          } else {
            panState.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }
          }
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={e => {
          const pan = panState.current
          if (pan !== null) {
            const rect = canvasRef.current?.getBoundingClientRect()
            if (rect === undefined || rect === null) return
            setView(v => ({ ...v, x: pan.ox + (e.clientX - pan.sx), y: pan.oy + (e.clientY - pan.sy) }))
            return
          }
          const p = toCanvas(e.clientX, e.clientY)
          const drag = dragNode.current
          if (drag !== null) {
            const node = data?.nodes.find(x => x.id === drag)
            if (node !== undefined) { node.x = p.x; node.y = p.y }
            return
          }
          const hit = pickNode(p.x, p.y)
          setHoverId(prev => (prev === hit ? prev : hit))
          if (hit !== null) {
            const node = data?.nodes.find(x => x.id === hit)
            if (node !== undefined) setHoverTip({ x: e.clientX - (canvasRef.current?.getBoundingClientRect().left ?? 0), y: e.clientY - (canvasRef.current?.getBoundingClientRect().top ?? 0), text: `${node.name}（${node.type}，deg ${node.degree}）` })
          } else setHoverTip(null)
        }}
        onPointerUp={e => {
          const p = toCanvas(e.clientX, e.clientY)
          const drag = dragNode.current
          if (drag !== null) {
            const moved = pickNode(p.x, p.y) === drag
            if (!moved) {
              // 单击节点：ego 高亮（再点取消）
              setEgoId(prev => (prev === drag ? null : drag))
            }
          }
          dragNode.current = null
          panState.current = null
        }}
        onPointerLeave={() => { dragNode.current = null; panState.current = null; setHoverTip(null) }}
        onDoubleClick={e => {
          const p = toCanvas(e.clientX, e.clientY)
          const hit = pickNode(p.x, p.y)
          if (hit !== null) setEgoId(prev => (prev === hit ? null : hit))
        }}
      />
      {hoverTip !== null && (
        <div className='gv-graph-tip' style={{ left: hoverTip.x + 12, top: hoverTip.y + 8 }}>{hoverTip.text}</div>
      )}
      <div className='gv-graph-hint'>{t('graphHint')}</div>
    </div>
  )
}

// ── Barnes-Hut 四叉树（模块级）──────────────────────────────────────────────
const BH_THETA = 0.9
function applyBH(root: QuadNode, node: { x: number; y: number }, k: number, dispX: Float64Array, dispY: Float64Array, selfIdx: number): void {
  const stack: QuadNode[] = [root]
  while (stack.length > 0) {
    const q = stack.pop()!
    if (q.mass === 0) continue
    const dx = q.cx - node.x
    const dy = q.cy - node.y
    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
    const isLeafItem = q.itemIdx >= 0
    if (isLeafItem && q.itemIdx === selfIdx) continue
    if (isLeafItem || ((q.x1 - q.x0) / d) < BH_THETA) {
      const f = (k * k * q.mass) / (d * d)
      dispX[selfIdx]! += (dx / d) * f
      dispY[selfIdx]! += (dy / d) * f
    } else {
      for (const c of q.child) if (c !== null) stack.push(c)
    }
  }
}

// ── Barnes-Hut 四叉树（模块级）──────────────────────────────────────────────
interface QuadNode {
  x0: number; y0: number; x1: number; y1: number
  mass: number
  cx: number; cy: number
  child: [QuadNode | null, QuadNode | null, QuadNode | null, QuadNode | null]
  itemIdx: number
}
function buildQuad(x0: number, y0: number, x1: number, y1: number): QuadNode {
  return { x0, y0, x1, y1, mass: 0, cx: 0, cy: 0, child: [null, null, null, null], itemIdx: -1 }
}
function quadInsert(q: QuadNode, item: { x: number; y: number }, idx: number): void {
  if (item.x < q.x0 || item.x > q.x1 || item.y < q.y0 || item.y > q.y1) return
  if (q.itemIdx === -1 && q.mass === 0) { q.itemIdx = idx; q.mass = 1; q.cx = item.x; q.cy = item.y; return }
  if (q.itemIdx >= 0) {
    const held = q.itemIdx
    q.itemIdx = -1
    quadInsertChild(q, q.cx, q.cy, held)
  }
  q.mass += 1
  q.cx = (q.cx * (q.mass - 1) + item.x) / q.mass
  q.cy = (q.cy * (q.mass - 1) + item.y) / q.mass
  quadInsertChild(q, item.x, item.y, idx)
}
function quadInsertChild(q: QuadNode, x: number, y: number, idx: number): void {
  const mx = (q.x0 + q.x1) / 2
  const my = (q.y0 + q.y1) / 2
  const i = (x >= mx ? 1 : 0) + (y >= my ? 2 : 0)
  let c = q.child[i] ?? null
  if (c === null) {
    const x0 = i % 2 === 0 ? q.x0 : mx
    const x1 = i % 2 === 0 ? mx : q.x1
    const y0 = i < 2 ? q.y0 : my
    const y1 = i < 2 ? my : q.y1
    c = buildQuad(x0, y0, x1, y1)
    q.child[i] = c
  }
  quadInsert(c, { x, y }, idx)
}



function ReviewTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [samples, setSamples] = useState<readonly ReviewSample[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(0)
  /** 更正编辑器：非空 = 错误/存疑后展开（预填当前三元组），携带待提交判定。 */
  const [correcting, setCorrecting] = useState<{ readonly verdict: 'wrong' | 'unsure'; readonly s: string; readonly r: string; readonly o: string } | null>(null)
  const [seeding, setSeeding] = useState(false)
  /** 滑选浮标：非空 = 证据区内有非空选区（视口坐标）。 */
  const [selChip, setSelChip] = useState<{ readonly x: number; readonly y: number; readonly text: string } | null>(null)

  // 证据区内滑选 → 出现「更正」浮标；点它用所选原文向模型要三元组预填编辑器
  const onEvidenceMouseUp = (): void => {
    const sel = window.getSelection()
    const text = sel?.toString() ?? ''
    const anchor = sel?.anchorNode?.parentElement
    if (sel === null || sel.isCollapsed || text.trim().length < 2 || anchor === null || anchor.closest('.gv-md, .gv-pre') === null) {
      setSelChip(null)
      return
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    setSelChip({ x: Math.max(8, rect.left), y: rect.bottom + 6, text: text.trim().slice(0, 2000) })
  }

  const seedFromSelection = (selected: string): void => {
    setSelChip(null)
    setSeeding(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'correctFromSelection', { id: kbId, text: selected }))
      .then((v) => {
        const triples = (v as { triples?: ReadonlyArray<{ s: string; r: string; o: string }> }).triples ?? []
        const best = triples[0]
        setCorrecting(prev => ({
          verdict: prev?.verdict ?? 'wrong',
          s: best?.s ?? prev?.s ?? '',
          r: best?.r ?? prev?.r ?? '',
          o: best?.o ?? prev?.o ?? '',
        }))
        if (best === undefined) runtime.pushNotice(t('selNoTriple'))
      })
      .catch(err => runtime.pushNotice(`${t('selFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setSeeding(false))
  }

  const load = (): void => {
    setLoading(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'sampleReview', { id: kbId, limit: 20 }))
      .then((v) => { setSamples(v as readonly ReviewSample[]); setIdx(0) })
      .catch(err => runtime.pushNotice(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [kbId])

  const verdict = (v: 'correct' | 'wrong' | 'unsure', correction?: { s: string; r: string; o: string }): void => {
    const sample = samples[idx]
    if (sample === undefined) return
    const payload: Record<string, unknown> = { id: kbId, relationId: sample.id, verdict: v }
    if (correction !== undefined) {
      // 仅携带与原值不同的字段；三字段全等则退化为纯判定
      const correction2: Record<string, string> = {}
      if (correction.s.trim() !== '' && correction.s.trim() !== sample.s) correction2.s = correction.s.trim()
      if (correction.r.trim() !== '' && correction.r.trim() !== sample.r) correction2.r = correction.r.trim()
      if (correction.o.trim() !== '' && correction.o.trim() !== sample.o) correction2.o = correction.o.trim()
      if (Object.keys(correction2).length > 0) payload['correction'] = correction2
    }
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'review', payload))
      .then(() => {
        setCorrecting(null)
        setDone(n => n + 1)
        if (idx + 1 >= samples.length) load()
        else setIdx(idx + 1)
      })
      .catch(err => runtime.pushNotice(String(err)))
  }

  const current = samples[idx]
  if (loading) return <div className='gv-empty'>{t('loading')}</div>
  if (current === undefined) {
    return (
      <div className='gv-empty'>
        {t('reviewExhausted', { done })}
        <div className='gv-actions'><button className='gv-btn' onClick={load}>{t('resample')}</button></div>
      </div>
    )
  }
  return (
    <div>
      <p className='gv-sub'>{t('reviewHint', { i: idx + 1, n: samples.length, done })}</p>
      <div className='gv-card'>
        <div className='gv-card-head'>
          <span className='gv-name'>{current.s}</span>
          <span className='gv-badge'>{current.r}</span>
          <span className='gv-name'>{current.o}</span>
          <span className='gv-badge'>{t('confidence')}: {current.confidence.toFixed(2)}</span>
        </div>
        <div className='gv-sub'>{t('reviewQuestion')}</div>
        <div onMouseUp={onEvidenceMouseUp}>
          {current.evidence.map((ev, i) => (
            <div key={i} className='gv-evidence'>
              <div className='gv-cost'>{ev.path}:{ev.startLine}-{ev.endLine}</div>
              <ChunkText text={ev.text} t={t} />
            </div>
          ))}
        </div>
        <div className='gv-actions'>
          <button className='gv-btn gv-btn-primary' onClick={() => verdict('correct')}>{t('verdictCorrect')}</button>
          <button className='gv-btn gv-btn-danger' onClick={() => setCorrecting({ verdict: 'wrong', s: current.s, r: current.r, o: current.o })}>{t('verdictWrong')}</button>
          <button className='gv-btn' onClick={() => setCorrecting({ verdict: 'unsure', s: current.s, r: current.r, o: current.o })}>{t('verdictUnsure')}</button>
        </div>
        {correcting !== null && (
          <div className='gv-form' style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--gv-fg-secondary, var(--dsw-alias-label-secondary, #5a6472))' }}>
              {t('correctionTitle')}
              {seeding && <span>…</span>}
            </div>
            <label>{t('correctionS')}</label>
            <input value={correcting.s} onChange={e => setCorrecting({ ...correcting, s: e.target.value })} />
            <label>{t('correctionR')}</label>
            <input value={correcting.r} onChange={e => setCorrecting({ ...correcting, r: e.target.value })} />
            <label>{t('correctionO')}</label>
            <input value={correcting.o} onChange={e => setCorrecting({ ...correcting, o: e.target.value })} />
            <div className='gv-actions'>
              <button className='gv-btn gv-btn-primary' onClick={() => verdict(correcting.verdict, { s: correcting.s, r: correcting.r, o: correcting.o })}>{t('correctionSubmit')}</button>
              <button className='gv-btn' onClick={() => verdict(correcting.verdict)}>{correcting.verdict === 'wrong' ? t('verdictOnlyWrong') : t('verdictOnlyUnsure')}</button>
              <button className='gv-btn' onClick={() => setCorrecting(null)}>{t('cancel')}</button>
            </div>
          </div>
        )}
        {selChip !== null && (
          <button
            className='gv-btn gv-btn-primary gv-selchip'
            style={{ left: selChip.x, top: selChip.y }}
            onMouseDown={e => e.preventDefault()}
            onClick={() => seedFromSelection(selChip.text)}
          >{t('selCorrect')}</button>
        )}
      </div>
    </div>
  )
}

/** 知识管理：补充新知识（粘贴文本入库）/ 来源清单（按文件删除）/ 授权目录编辑。 */
function ManageTab(props: {
  readonly runtime: KbRuntime
  readonly t: Translate
  readonly kbId: string
  readonly roots: readonly string[]
}): React.ReactElement {
  const { runtime, t, kbId, roots } = props
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('')
  const [sources, setSources] = useState<readonly KnowledgeSource[]>([])
  const [changes, setChanges] = useState<{ added: number; changed: readonly string[]; removed: readonly string[] } | null>(null)
  const [rootsText, setRootsText] = useState(roots.join('\n'))
  const [rootsSaved, setRootsSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyPath, setBusyPath] = useState<string | null>(null)

  const loadSources = (): void => {
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'sources', { id: kbId }))
      .then(v => setSources(v as readonly KnowledgeSource[]))
      .catch(err => runtime.pushNotice(String(err)))
  }
  const loadChanges = (): void => {
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'changes', { id: kbId }))
      .then(v => setChanges(v as { added: number; changed: readonly string[]; removed: readonly string[] }))
      .catch(() => setChanges(null))
  }
  useEffect(() => { loadSources(); loadChanges() }, [kbId])

  const addText = (): void => {
    if (text.trim() === '') return
    setBusy(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'addText', { id: kbId, title: title.trim(), text }))
      .then(() => {
        runtime.pushNotice(t('manageNoteAdded'))
        setTitle('')
        setText('')
        loadSources()
      })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusy(false))
  }

  const runFor = (rpc: string, payload: Record<string, unknown>, notice: string): void => {
    setBusyPath(String(payload['path'] ?? ''))
    void unwrap(runtime.rpc.call(RPC_CHANNEL, rpc, { id: kbId, ...payload }))
      .then(() => { runtime.pushNotice(notice); loadSources(); loadChanges() })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusyPath(null))
  }

  const removeSource = (path: string): void => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('manageConfirmDelete'))) return
    runFor('forgetFile', { path }, t('manageFileDeleted'))
  }
  const reindexSource = (path: string): void => {
    runFor('reindexSource', { path }, t('manageReindexed'))
  }
  const toggleSource = (path: string, enabled: boolean): void => {
    runFor('setSourceEnabled', { path, enabled }, enabled ? t('manageEnabled') : t('manageDisabled'))
  }

  const importDirectory = (): void => {
    setBusy(true)
    void runtime.bridge.pickDirectory()
      .then((dir) => {
        if (dir === null) return
        return unwrap(runtime.rpc.call(RPC_CHANNEL, 'importFiles', { id: kbId, dir }))
          .then((v) => {
            const r = v as { imported: number; skipped: readonly { path: string; reason: string }[] }
            runtime.pushNotice(t('manageImported', { count: r.imported, skipped: r.skipped.length }))
            loadSources()
            loadChanges()
          })
      })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusy(false))
  }

  const saveRoots = (): void => {
    const next = rootsText.split('\n').map(l => l.trim()).filter(l => l !== '')
    setBusy(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'updateKb', { id: kbId, roots: next }))
      .then(() => { setRootsSaved(true); setTimeout(() => setRootsSaved(false), 2000) })
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setBusy(false))
  }

  const visible = sources.filter(s => filter.trim() === '' || s.path.toLowerCase().includes(filter.trim().toLowerCase()))
  const changeTotal = changes === null ? 0 : changes.added + changes.changed.length + changes.removed.length

  return (
    <div>
      <div className='gv-card'>
        <div className='gv-card-head'><span className='gv-name'>{t('manageAddTitle')}</span></div>
        <label>{t('manageAddName')}</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('manageAddNameHint')} />
        <label>{t('manageAddText')}</label>
        <textarea value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 140 }} placeholder={t('manageAddTextHint')} />
        <div className='gv-actions'>
          <button className='gv-btn gv-btn-primary' disabled={busy || text.trim() === ''} onClick={addText}>{t('manageAddSubmit')}</button>
          <button className='gv-btn' disabled={busy} onClick={importDirectory}>{t('manageImport')}</button>
        </div>
      </div>

      <div className='gv-card'>
        <div className='gv-card-head'>
          <span className='gv-name'>{t('manageSources')}</span>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={t('manageFilterHint')}
            style={{ flex: 1, minWidth: 120 }}
          />
        </div>
        {changes !== null && changeTotal > 0 && (
          <div className='gv-notice' style={{ marginBottom: 8 }}>
            <span>{t('manageChanges', { added: changes.added, changed: changes.changed.length, removed: changes.removed.length })}</span>
            <button className='gv-btn' onClick={() => { void runtime.startIndex(kbId) }}>{t('manageSyncIndex')}</button>
          </div>
        )}
        {visible.length === 0 && <div className='gv-empty'>{sources.length === 0 ? t('manageEmpty') : t('manageNoMatch')}</div>}
        <table className='gv-table'>
          <tbody>
            {visible.map(s => (
              <tr key={s.path}>
                <td style={{ wordBreak: 'break-all' }}>
                  {s.path}
                  {s.isNote && <span className='gv-badge' style={{ marginLeft: 6 }}>{t('badgeNote')}</span>}
                  {s.state === 'disabled' && <span className='gv-badge' style={{ marginLeft: 4 }}>{t('badgeDisabled')}</span>}
                  {s.error !== null && s.error !== '' && <div className='gv-cost'>{s.error}</div>}
                </td>
                <td style={{ width: 56 }}>{s.ext !== '' ? s.ext.slice(1) : '—'}</td>
                <td style={{ width: 60 }}>{s.state}</td>
                <td style={{ width: 96 }} className='gv-cost'>{t('manageContribution', { chunks: s.stats.chunks, entities: s.stats.entities, relations: s.stats.relations })}</td>
                <td style={{ width: 84 }} className='gv-cost'>{formatTime(s.mtimeMs, t)}</td>
                <td style={{ width: 150 }}>
                  <div className='gv-actions' style={{ margin: 0, flexWrap: 'nowrap' }}>
                    <button className='gv-btn' disabled={busyPath !== null} onClick={() => reindexSource(s.path)}>{t('manageReindex')}</button>
                    {s.state === 'disabled'
                      ? <button className='gv-btn' disabled={busyPath !== null} onClick={() => toggleSource(s.path, true)}>{t('manageEnable')}</button>
                      : <button className='gv-btn' disabled={busyPath !== null} onClick={() => toggleSource(s.path, false)}>{t('manageDisable')}</button>}
                    <button className='gv-btn gv-btn-danger' disabled={busyPath !== null} onClick={() => removeSource(s.path)}>{t('manageDelete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='gv-card'>
        <div className='gv-card-head'><span className='gv-name'>{t('manageRootsTitle')}</span></div>
        <textarea value={rootsText} onChange={e => { setRootsText(e.target.value); setRootsSaved(false) }} style={{ minHeight: 60 }} />
        <div className='gv-actions'>
          <button className='gv-btn' disabled={busy} onClick={saveRoots}>{rootsSaved ? t('manageRootsSaved') : t('manageRootsSave')}</button>
        </div>
      </div>
    </div>
  )
}

function HealthTab(props: { readonly runtime: KbRuntime; readonly t: Translate; readonly kbId: string }): React.ReactElement {
  const { runtime, t, kbId } = props
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'health', { id: kbId }))
      .then(v => setReport(v as HealthReport))
      .catch(err => runtime.pushNotice(String(err)))
      .finally(() => setLoading(false))
  }, [kbId])

  if (loading || report === null) return <div className='gv-empty'>{t('loading')}</div>
  const pct = (x: number | null): string => x === null ? t('never') : `${Math.round(x * 100)}%`
  return (
    <div className='gv-card'>
      <div className='gv-card-head'><span className='gv-name'>{t('healthTitle')} — {report.kbName}</span></div>
      <table className='gv-table'>
        <tbody>
          <tr><td>{t('coverage')}</td><td>{pct(report.coverage)}</td></tr>
          <tr><td>{t('filesIndexed')}</td><td>{report.files.indexed}{report.files.stale > 0 ? `（${t('stale')} ${report.files.stale}）` : ''}</td></tr>
          <tr><td>{t('quarantined')}</td><td>{report.files.quarantined}{report.quarantineRate !== null ? `（${pct(report.quarantineRate)}）` : ''}</td></tr>
          <tr><td>{t('samplePrecision')}</td><td>{report.samplePrecision === null ? t('never') : `${report.correct}/${report.sampled} = ${pct(report.samplePrecision)}`}</td></tr>
          <tr><td>{t('healthCorrected')}</td><td>{report.corrected}</td></tr>
          <tr><td>{t('excluded')}</td><td>{report.excludedRelations}</td></tr>
          <tr><td>{t('lastIndex')}</td><td>{formatAt(report.lastIndexAt)}</td></tr>
        </tbody>
      </table>
      <p className='gv-sub'>{t('healthNote')}</p>
    </div>
  )
}

function formatAt(at: number | null): string {
  if (at === null || at === 0) return '—'
  const d = new Date(at)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
