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

  // 两列宽度拖拽：右列百分比可调（记忆到 localStorage）
  const [rightPct, setRightPct] = useState<number>(() => {
    try {
      const stored = Number(window.localStorage.getItem('gv-split-right-pct'))
      if (Number.isFinite(stored) && stored >= 20 && stored <= 75) return stored
    } catch { /* ignore */ }
    return 44
  })
  const [dividerDrag, setDividerDrag] = useState(false)
  const splitRef = useRef<HTMLDivElement | null>(null)
  const rightPctRef = useRef(rightPct)
  const dividerDown = (e: React.PointerEvent): void => {
    e.preventDefault()
    setDividerDrag(true)
    rightPctRef.current = rightPct
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    document.body.style.userSelect = 'none'
  }
  const dividerMove = (e: React.PointerEvent): void => {
    if (!dividerDrag) return
    const rect = splitRef.current?.getBoundingClientRect()
    if (rect === undefined || rect === null || rect.width === 0) return
    const pct = Math.max(20, Math.min(75, ((rect.right - e.clientX) / rect.width) * 100))
    rightPctRef.current = pct
    setRightPct(pct)
  }
  const dividerUp = (): void => {
    if (!dividerDrag) return
    setDividerDrag(false)
    document.body.style.userSelect = ''
    try { window.localStorage.setItem('gv-split-right-pct', String(rightPctRef.current)) } catch { /* ignore */ }
  }

  return (
    <div className='gv-split' ref={splitRef}>
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
      <div
        className='gv-split-divider'
        data-drag={dividerDrag ? '1' : '0'}
        title={t('splitDrag')}
        onPointerDown={dividerDown}
        onPointerMove={dividerMove}
        onPointerUp={dividerUp}
      />
      <div className='gv-split-right' style={{ flex: `0 0 ${rightPct}%` }}>
        <GraphView t={t} runtime={runtime} kbId={kbId} />
      </div>
    </div>
  )
}

// ── 图谱视图（全量力导向 Canvas；布局在世界坐标系展开，视口只是取景窗口）──
// 性能契约：渲染循环只读 ref（滚轮/平移/悬停不触发 React 渲染），收敛后零绘制；
// id→节点/邻接表随数据构建一次（O(1) 查表），杜绝每帧 O(E×N) 重建导致的冻结。

const TYPE_COLORS: Record<string, string> = {
  module: '#4b7bec', file: '#a55eea', function: '#26de81', class: '#fd9644',
  type: '#fc5c65', concept: '#45aaf2', config: '#a5b1c2', cli: '#6ab04c',
  api: '#e84393', external_dependency: '#eb3b5a', test: '#2bcbba',
}
function typeColor(t: string): string {
  return TYPE_COLORS[t] ?? '#8892a0'
}

/** 布局理想间距（世界单位）：接触斥力的平衡距离。节点再多也按此摊开，靠缩放取景。 */
const LAYOUT_K = 40
/** 斥力在接触区（d<K）取线性斜率：d→0 时有限但持续推开，杜绝 FR 式坍缩结块。 */
const CONTACT_F = 100
/** Hooke 弹簧刚度与锚距（1.6K）：近拉远推，替代 d² 吸引（后者远场过强致坨缩）。 */
const SPRING_STIFF = 0.05
const SPRING_REST = LAYOUT_K * 1.6
/** 向心系数：弱到只防弱连通分量漂散，不参与挤压。 */
const GRAVITY = 0.003
/** 每帧位移封顶（世界单位）与退火底限。 */
const MOVE_CAP = 30
const FOCUS_COLOR = '#4176e6'

interface GNode {
  readonly id: number
  readonly name: string
  readonly type: string
  readonly degree: number
  x: number
  y: number
}
interface GEdge {
  readonly s: number
  readonly t: number
  readonly type: string
  readonly weight: number
}
interface GraphIndex {
  readonly byId: Map<number, GNode>
  readonly adj: Map<number, readonly { readonly edge: GEdge; readonly other: number }[]>
  readonly hubs: readonly GNode[]
}

/** 黄金角螺旋初始布点：按度数降序插入——枢纽居中、叶子外缘，确定性且均匀。 */
function seedPositions(nodes: readonly GNode[]): void {
  const order = [...nodes].sort((a, b) => b.degree - a.degree)
  const golden = Math.PI * (3 - Math.sqrt(5))
  order.forEach((node, i) => {
    const r = LAYOUT_K * 0.62 * Math.sqrt(i + 0.6)
    const th = i * golden
    node.x = r * Math.cos(th)
    node.y = r * Math.sin(th)
  })
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const u = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy))
}

/** 导出仅供开发态 harness（真实规模数据渲染验证）与后续回归使用；面板内经 BrowseTab 引用。 */
export function GraphView(props: { readonly t: Translate; readonly runtime: KbRuntime; readonly kbId: string }): React.ReactElement {
  const { t, runtime, kbId } = props
  /** 全量图谱数据（与卡片头统计同源：节点=全部实体，边=全部关系）。 */
  const [data, setData] = useState<{ nodes: GNode[]; edges: GEdge[] } | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [selId, setSelId] = useState<number | null>(null)
  const [selEdge, setSelEdge] = useState<number | null>(null)
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set())
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [layoutPaused, setLayoutPaused] = useState(false)
  const [search, setSearch] = useState('')
  const [canLocate, setCanLocate] = useState(false)

  // 热路径（滚轮/平移/悬停/拖拽）只动 ref + 脏标记，不触发 React 渲染
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dataRef = useRef<{ nodes: GNode[]; edges: GEdge[] } | null>(null)
  const viewRef = useRef({ x: 0, y: 0, k: 1 })
  const alphaRef = useRef(0)
  const dirtyRef = useRef(true)
  const pausedRef = useRef(false)
  const userMovedRef = useRef(false)
  const hoverNodeRef = useRef<number | null>(null)
  const hoverEdgeRef = useRef<number | null>(null)
  const selRef = useRef<number | null>(null)
  const selEdgeRef = useRef<number | null>(null)
  const hiddenRef = useRef<ReadonlySet<string>>(new Set())
  const fgRef = useRef('#d7dce2')
  const tipKeyRef = useRef('')
  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const dragRef = useRef<{ mode: 'idle' | 'press'; id: number | null; sx: number; sy: number; ox: number; oy: number; moved: boolean }>({ mode: 'idle', id: null, sx: 0, sy: 0, ox: 0, oy: 0, moved: false })

  /** 查表：id→节点 / 邻接表 / 枢纽序（度数降序，远景只标前若干个）。 */
  const index = useMemo<GraphIndex | null>(() => {
    if (data === null) return null
    const byId = new Map<number, GNode>()
    for (const n of data.nodes) byId.set(n.id, n)
    const adj = new Map<number, { edge: GEdge; other: number }[]>()
    for (const e of data.edges) {
      let la = adj.get(e.s)
      if (la === undefined) { la = []; adj.set(e.s, la) }
      let lb = adj.get(e.t)
      if (lb === undefined) { lb = []; adj.set(e.t, lb) }
      la.push({ edge: e, other: e.t })
      lb.push({ edge: e, other: e.s })
    }
    const hubs = [...data.nodes].sort((a, b) => b.degree - a.degree)
    return { byId, adj, hubs }
  }, [data])
  const indexRef = useRef<GraphIndex | null>(index)
  indexRef.current = index

  const applySel = (id: number | null): void => { selRef.current = id; setSelId(id); dirtyRef.current = true }
  const applySelEdge = (i: number | null): void => { selEdgeRef.current = i; setSelEdge(i); dirtyRef.current = true }
  const applyHidden = (next: ReadonlySet<string>): void => { hiddenRef.current = next; setHiddenTypes(next); dirtyRef.current = true }

  useEffect(() => {
    let alive = true
    void unwrap(runtime.rpc.call(RPC_CHANNEL, 'graphAll', { id: kbId }))
      .then((v) => {
        if (!alive) return
        const r = v as { nodes: { id: number; name: string; type: string; degree: number }[]; edges: { s: number; t: number; type: string; weight: number }[] }
        const nodes: GNode[] = r.nodes.map(n => ({ id: n.id, name: n.name, type: n.type, degree: n.degree, x: 0, y: 0 }))
        const edges: GEdge[] = r.edges.map(e => ({ s: e.s, t: e.t, type: e.type, weight: e.weight }))
        seedPositions(nodes)
        dataRef.current = { nodes, edges }
        setData(dataRef.current)
        alphaRef.current = 1
        frameRef.current = 0
        userMovedRef.current = false
        applySel(null)
        applySelEdge(null)
        applyHidden(new Set())
      })
      .catch(err => { if (alive) setLoadErr(String(err)) })
    return () => { alive = false }
  }, [kbId])

  useEffect(() => {
    if (selId === null) { setCanLocate(false); return }
    setCanLocate(document.getElementById(`gv-card-${selId}`) !== null)
  }, [selId])

  /** 取景：全图包围盒适配视口。stick=true 表示用户主动（此后不再自动取景）。 */
  const fitToView = (stick: boolean): void => {
    const d = dataRef.current
    const wrap = wrapRef.current
    if (d === null || wrap === null || d.nodes.length === 0) return
    const rect = wrap.getBoundingClientRect()
    const W = Math.max(rect.width, 60)
    const H = Math.max(rect.height, 60)
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
    for (const n of d.nodes) {
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x > maxX) maxX = n.x
      if (n.y > maxY) maxY = n.y
    }
    const bw = Math.max(maxX - minX, LAYOUT_K)
    const bh = Math.max(maxY - minY, LAYOUT_K)
    const k = Math.max(0.04, Math.min(2.5, Math.min((W - 48) / bw, (H - 48) / bh)))
    viewRef.current = { k, x: W / 2 - (minX + bw / 2) * k, y: H / 2 - (minY + bh / 2) * k }
    if (stick) userMovedRef.current = true
    dirtyRef.current = true
  }

  const zoomStep = (factor: number): void => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const cx = (rect?.width ?? 600) / 2
    const cy = (rect?.height ?? 400) / 2
    const v = viewRef.current
    const k = Math.max(0.04, Math.min(4, v.k * factor))
    viewRef.current = { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }
    userMovedRef.current = true
    dirtyRef.current = true
  }

  /** 搜索命中 → 选中并居中（保持当前缩放，过小则提到 1 倍可读）。 */
  const locateNode = (node: GNode): void => {
    applySel(node.id)
    applySelEdge(null)
    const rect = wrapRef.current?.getBoundingClientRect()
    const v = viewRef.current
    const k = Math.max(v.k, 1)
    viewRef.current = { k, x: (rect?.width ?? 600) / 2 - node.x * k, y: (rect?.height ?? 400) / 2 - node.y * k }
    userMovedRef.current = true
    dirtyRef.current = true
  }

  const toggleType = (type: string): void => {
    const next = new Set(hiddenRef.current)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    applyHidden(next)
  }

  // ── 力导向一步（世界坐标）：网格近场接触斥力 + Hooke 弹簧 + 微弱向心 ──
  // 健康摊开后每格约 1 节点，每帧只需 ~9 格邻域配对（O(n)，快于四叉树）；
  // FR 的 d² 弹簧+平方斥力会把稀疏图压成致密核（仿真实证 81% 节点堆入一格），故弃用。
  const layoutStep = (d: { nodes: GNode[]; edges: GEdge[] }): void => {
    const nodes = d.nodes
    const n = nodes.length
    if (n === 0) { alphaRef.current = 0; return }
    const cell = new Map<number, number[]>()
    nodes.forEach((node, i) => {
      const key = Math.floor(node.x / LAYOUT_K) * 131072 + Math.floor(node.y / LAYOUT_K)
      let list = cell.get(key)
      if (list === undefined) { list = []; cell.set(key, list) }
      list.push(i)
    })
    const dispX = new Float64Array(n)
    const dispY = new Float64Array(n)
    const indexBy = new Map<number, number>()
    nodes.forEach((node, i) => indexBy.set(node.id, i))
    for (let i = 0; i < n; i++) {
      const a = nodes[i]!
      const gx = Math.floor(a.x / LAYOUT_K)
      const gy = Math.floor(a.y / LAYOUT_K)
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const list = cell.get((gx + ox) * 131072 + (gy + oy))
          if (list === undefined) continue
          for (const j of list) {
            if (j <= i) continue
            const b = nodes[j]!
            let dx = a.x - b.x
            let dy = a.y - b.y
            let dist = Math.hypot(dx, dy)
            if (dist < 1e-6) {
              // 同位节点：按索引确定性抖开（随机抖动会让重排结果不可复现）
              const ang = (i * 2.399963 + j) % (Math.PI * 2)
              dx = Math.cos(ang)
              dy = Math.sin(ang)
              dist = 1
            }
            const f = dist < LAYOUT_K ? (CONTACT_F * (2 * LAYOUT_K - dist)) / LAYOUT_K : (LAYOUT_K * LAYOUT_K) / (dist * dist)
            const ux = dx / dist
            const uy = dy / dist
            dispX[i]! += ux * f
            dispY[i]! += uy * f
            dispX[j]! -= ux * f
            dispY[j]! -= uy * f
          }
        }
      }
    }
    for (const e of d.edges) {
      const ia = indexBy.get(e.s)
      const ib = indexBy.get(e.t)
      if (ia === undefined || ib === undefined) continue
      const a = nodes[ia]!
      const b = nodes[ib]!
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.max(Math.hypot(dx, dy), 1)
      const f = (dist - SPRING_REST) * SPRING_STIFF
      const ux = dx / dist
      const uy = dy / dist
      dispX[ia]! -= ux * f
      dispY[ia]! -= uy * f
      dispX[ib]! += ux * f
      dispY[ib]! += uy * f
    }
    const pinnedId = dragRef.current.id
    for (let i = 0; i < n; i++) {
      const node = nodes[i]!
      dispX[i]! -= node.x * GRAVITY
      dispY[i]! -= node.y * GRAVITY
      const mag = Math.hypot(dispX[i]!, dispY[i]!)
      if (mag < 1e-9) continue
      const limit = Math.min(mag, MOVE_CAP) * alphaRef.current
      if (pinnedId !== node.id) {
        node.x += (dispX[i]! / mag) * limit
        node.y += (dispY[i]! / mag) * limit
      }
    }
    alphaRef.current = alphaRef.current < 0.02 ? 0 : alphaRef.current * 0.996
  }

  // ── 绘制：世界坐标图元 + 屏幕空间标签；视口裁剪 + 聚焦置暗（不擦除）──
  const draw = (wrap: HTMLDivElement): void => {
    const canvas = canvasRef.current
    const d = dataRef.current
    const idx = indexRef.current
    if (canvas === null || d === null || idx === null) return
    const rect = wrap.getBoundingClientRect()
    const W = Math.max(rect.width, 60)
    const H = Math.max(rect.height, 60)
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
    }
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    const view = viewRef.current
    const hidden = hiddenRef.current
    const sel = selRef.current
    const selE = selEdgeRef.current
    const activeEdge = hoverEdgeRef.current ?? selE
    // 聚焦集：选中节点 + 一跳邻居；其余置暗而非擦除，保住上下文
    let focus: Set<number> | null = null
    let focusEdges: Set<GEdge> | null = null
    if (sel !== null) {
      focus = new Set<number>([sel])
      focusEdges = new Set<GEdge>()
      for (const link of idx.adj.get(sel) ?? []) { focus.add(link.other); focusEdges.add(link.edge) }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    // 视口世界矩形（含余量），裁剪可见图元
    const wx0 = -view.x / view.k - 60
    const wy0 = -view.y / view.k - 60
    const wx1 = (W - view.x) / view.k + 60
    const wy1 = (H - view.y) / view.k + 60
    const on = (n: GNode): boolean => !hidden.has(n.type) && n.x >= wx0 && n.x <= wx1 && n.y >= wy0 && n.y <= wy1
    /** 边索引 → 端点对（越界/端点缺失返回 null，noUncheckedIndexedAccess 兜底）。 */
    const edgeEnds = (i: number | null): { readonly a: GNode; readonly b: GNode; readonly e: GEdge } | null => {
      if (i === null) return null
      const e = d.edges[i]
      if (e === undefined) return null
      const a = idx.byId.get(e.s)
      const b = idx.byId.get(e.t)
      if (a === undefined || b === undefined) return null
      return { a, b, e }
    }
    const arrow = (a: GNode, b: GNode): void => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.max(Math.hypot(dx, dy), 1)
      const ux = dx / dist
      const uy = dy / dist
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
    ctx.save()
    ctx.translate(view.x, view.y)
    ctx.scale(view.k, view.k)
    // 边（聚焦时非邻接边压到近隐形；端点都不在视口内的跳过）
    ctx.lineWidth = 1 / view.k
    ctx.strokeStyle = focus !== null ? 'rgba(128,138,152,0.08)' : 'rgba(128,138,152,0.32)'
    ctx.beginPath()
    for (const e of d.edges) {
      if (focusEdges !== null && focusEdges.has(e)) continue
      const a = idx.byId.get(e.s)
      const b = idx.byId.get(e.t)
      if (a === undefined || b === undefined || hidden.has(a.type) || hidden.has(b.type)) continue
      const aIn = a.x >= wx0 && a.x <= wx1 && a.y >= wy0 && a.y <= wy1
      const bIn = b.x >= wx0 && b.x <= wx1 && b.y >= wy0 && b.y <= wy1
      if (!aIn && !bIn) continue
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
    ctx.stroke()
    // 高亮边：选中节点的邻接边 + 悬停/点选的那条关系边
    ctx.strokeStyle = FOCUS_COLOR
    ctx.lineWidth = 1.6 / view.k
    ctx.beginPath()
    for (const e of focusEdges ?? []) {
      const a = idx.byId.get(e.s)
      const b = idx.byId.get(e.t)
      if (a === undefined || b === undefined) continue
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
    if (activeEdge !== null) {
      const ends = edgeEnds(activeEdge)
      if (ends !== null) { ctx.moveTo(ends.a.x, ends.a.y); ctx.lineTo(ends.b.x, ends.b.y) }
    }
    ctx.stroke()
    // 箭头：高亮边常绘；普通边放大到可辨才绘
    ctx.fillStyle = FOCUS_COLOR
    for (const e of focusEdges ?? []) {
      const a = idx.byId.get(e.s)
      const b = idx.byId.get(e.t)
      if (a !== undefined && b !== undefined) arrow(a, b)
    }
    if (activeEdge !== null) {
      const ends = edgeEnds(activeEdge)
      if (ends !== null && (focusEdges === null || !focusEdges.has(ends.e))) arrow(ends.a, ends.b)
    }
    if (view.k > 1.6) {
      ctx.fillStyle = 'rgba(128,138,152,0.6)'
      for (const e of d.edges) {
        if (focusEdges !== null && focusEdges.has(e)) continue
        const a = idx.byId.get(e.s)
        const b = idx.byId.get(e.t)
        if (a === undefined || b === undefined || hidden.has(a.type) || hidden.has(b.type)) continue
        if (!on(a) && !on(b)) continue
        arrow(a, b)
      }
    }
    // 节点：聚焦域正常、其余 0.12 透明度（按类型分批填充）
    const drawNodes = (dim: boolean): void => {
      const batch = new Map<string, GNode[]>()
      for (const node of d.nodes) {
        if (!on(node)) continue
        const isDim = focus !== null && !focus.has(node.id)
        if (isDim !== dim) continue
        let list = batch.get(node.type)
        if (list === undefined) { list = []; batch.set(node.type, list) }
        list.push(node)
      }
      for (const [type, list] of batch) {
        ctx.fillStyle = typeColor(type)
        ctx.beginPath()
        for (const node of list) {
          const r = nodeR(node)
          ctx.moveTo(node.x + r, node.y)
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        }
        ctx.fill()
      }
    }
    ctx.globalAlpha = 0.12
    drawNodes(true)
    ctx.globalAlpha = 1
    drawNodes(false)
    // 悬停/选中节点描环
    ctx.lineWidth = 1.6 / view.k
    for (const node of d.nodes) {
      const isHot = hoverNodeRef.current === node.id
      const isSel = sel === node.id
      if (!isHot && !isSel) continue
      ctx.strokeStyle = isSel ? FOCUS_COLOR : 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.arc(node.x, node.y, nodeR(node) + 2.5 / view.k, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    // 标签（屏幕空间，字号恒定可读）：远景只标枢纽 + 热点，放大后视口内全标；
    // 中性灰描边做晕圈，浅色/深色主题下都压得住底图
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const fg = fgRef.current
    const hubN = view.k >= 1 ? Number.POSITIVE_INFINITY : view.k >= 0.55 ? 60 : 18
    let labeled = 0
    for (const node of idx.hubs) {
      const isHot = hoverNodeRef.current === node.id || sel === node.id
      if (hidden.has(node.type)) continue
      const sx = node.x * view.k + view.x
      const sy = node.y * view.k + view.y
      if (sx < -70 || sx > W + 70 || sy < -20 || sy > H + 20) continue
      if (!isHot) {
        if (focus !== null && !focus.has(node.id)) continue
        if (labeled >= hubN) continue
        labeled++
      }
      const text = node.name.length > 16 ? `${node.name.slice(0, 15)}…` : node.name
      const ty = sy + nodeR(node) * view.k + 11
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(127,127,127,0.6)'
      ctx.strokeText(text, sx, ty)
      ctx.fillStyle = fg
      ctx.fillText(text, sx, ty)
    }
    // 悬停/点选的关系边：中点标关系类型
    if (activeEdge !== null) {
      const ends = edgeEnds(activeEdge)
      if (ends !== null && !hidden.has(ends.a.type) && !hidden.has(ends.b.type)) {
        const mx = (ends.a.x + ends.b.x) / 2 * view.k + view.x
        const my = (ends.a.y + ends.b.y) / 2 * view.k + view.y
        const text = `${ends.e.type} · w=${ends.e.weight}`
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(127,127,127,0.6)'
        ctx.strokeText(text, mx, my - 4)
        ctx.fillStyle = FOCUS_COLOR
        ctx.fillText(text, mx, my - 4)
      }
    }
  }

  // 每帧一步：布局（未收敛且未暂停）→ 脏了才绘制。stepRef 每渲染刷新，
  // 循环 effect 只挂载一次，天然读到最新 index；收敛后每帧只剩两个 if。
  const stepRef = useRef((): void => {})
  stepRef.current = () => {
    const d = dataRef.current
    const wrap = wrapRef.current
    if (d === null || wrap === null) return
    if (!pausedRef.current && alphaRef.current > 0.015) {
      layoutStep(d)
      dirtyRef.current = true
      frameRef.current++
      // 布局期间自动取景跟手（用户一旦手动平移/缩放即停）；收敛时定帧
      if (!userMovedRef.current && (frameRef.current % 30 === 0 || alphaRef.current <= 0.015)) fitToView(false)
    }
    if (dirtyRef.current) {
      draw(wrap)
      dirtyRef.current = false
    }
  }

  // ── 动画循环 + 视口观察（只挂载一次）──
  useEffect(() => {
    const tick = (): void => {
      stepRef.current()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    const ro = new ResizeObserver(() => {
      dirtyRef.current = true
      const wrap = wrapRef.current
      if (wrap !== null) fgRef.current = getComputedStyle(wrap).color
    })
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (wrap !== null) ro.observe(wrap)
    // 滚轮缩放：native 非被动监听（React 合成 wheel 是被动的，preventDefault 无效），
    // 锚定光标缩放，不联动页面滚动
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect === null || rect === undefined) return
      const v = viewRef.current
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const k = Math.max(0.04, Math.min(4, v.k * factor))
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      viewRef.current = { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }
      userMovedRef.current = true
      dirtyRef.current = true
    }
    canvas?.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas?.removeEventListener('wheel', onWheel)
    }
  }, [])

  const nodeR = (n: { degree: number }): number => 4 + Math.min(12, Math.sqrt(n.degree) * 1.7)

  const toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect === undefined || rect === null) return { x: 0, y: 0 }
    const v = viewRef.current
    return { x: (clientX - rect.left - v.x) / v.k, y: (clientY - rect.top - v.y) / v.k }
  }

  const pickNode = (x: number, y: number): number | null => {
    const idx = indexRef.current
    if (idx === null) return null
    const slop = 6 / viewRef.current.k
    let best: number | null = null
    let bestD = Infinity
    for (const node of idx.byId.values()) {
      if (hiddenRef.current.has(node.type)) continue
      const d = Math.hypot(node.x - x, node.y - y)
      if (d < nodeR(node) + slop && d < bestD) { best = node.id; bestD = d }
    }
    return best
  }

  /** 边命中：点 到 线段 距离；缩放过小时不启用（密集区必选错）。 */
  const pickEdge = (x: number, y: number): number | null => {
    const idx = indexRef.current
    const d = dataRef.current
    if (idx === null || d === null || viewRef.current.k < 0.6) return null
    const slop = 5 / viewRef.current.k
    let best: number | null = null
    let bestD = slop
    for (let i = 0; i < d.edges.length; i++) {
      const e = d.edges[i]!
      const a = idx.byId.get(e.s)
      const b = idx.byId.get(e.t)
      if (a === undefined || b === undefined || hiddenRef.current.has(a.type) || hiddenRef.current.has(b.type)) continue
      const dist = distToSeg(x, y, a.x, a.y, b.x, b.y)
      if (dist < bestD) { bestD = dist; best = i }
    }
    return best
  }

  /** tooltip 只在命中目标变化时 setState（不跟随像素级移动，避免每 move 重渲染）。 */
  const showTip = (x: number, y: number, key: string, text: string): void => {
    if (tipKeyRef.current === key) return
    tipKeyRef.current = key
    setHoverTip({ x: x + 12, y: y + 8, text })
  }
  const clearTip = (): void => {
    if (tipKeyRef.current === '') return
    tipKeyRef.current = ''
    setHoverTip(null)
  }

  const typesUsed = useMemo(() => {
    if (data === null) return []
    const set = new Map<string, number>()
    for (const n of data.nodes) set.set(n.type, (set.get(n.type) ?? 0) + 1)
    return [...set.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q === '' || data === null) return []
    const out: GNode[] = []
    for (const n of data.nodes) {
      if (n.name.toLowerCase().includes(q)) {
        out.push(n)
        if (out.length >= 8) break
      }
    }
    return out
  }, [search, data])

  if (loadErr !== null) {
    return <div className='gv-graph'><div className='gv-empty'>{t('loadFailed')}: {loadErr}</div></div>
  }
  if (data === null) {
    return <div className='gv-graph'><div className='gv-empty'>{t('loading')}</div></div>
  }

  const selNode = selId !== null ? index?.byId.get(selId) : undefined
  const selNeighbors = selId !== null && index !== null ? index.adj.get(selId) ?? [] : []

  const resetDrag = (): void => { dragRef.current = { mode: 'idle', id: null, sx: 0, sy: 0, ox: 0, oy: 0, moved: false } }

  return (
    <div className='gv-graph' ref={wrapRef}>
      <div className='gv-graph-head'>
        <span className='gv-name'>{t('graphTitle')}</span>
        <span className='gv-badge'>
          {t('graphCounts', { nodes: data.nodes.length, edges: data.edges.length })}
          {hiddenTypes.size > 0 ? ` ${t('graphFiltered', { n: hiddenTypes.size })}` : ''}
        </span>
        <div className='gv-graph-search'>
          <input value={search} placeholder={t('graphSearchPlaceholder')} onChange={e => setSearch(e.target.value)} />
          {search.trim() !== '' && (
            <div className='gv-graph-searchlist'>
              {matches.length === 0 && <span className='gv-graph-search-empty'>{t('graphSearchEmpty')}</span>}
              {matches.map(n => (
                <button key={n.id} onClick={() => { locateNode(n); setSearch('') }}>{n.name}（{n.type}）</button>
              ))}
            </div>
          )}
        </div>
        <div className='gv-actions'>
          <button className='gv-btn' onClick={() => { pausedRef.current = !pausedRef.current; setLayoutPaused(pausedRef.current); dirtyRef.current = true }}>{layoutPaused ? t('graphResume') : t('graphPause')}</button>
          <button className='gv-btn' onClick={() => {
            const d = dataRef.current
            if (d === null) return
            pausedRef.current = false
            setLayoutPaused(false)
            seedPositions(d.nodes)
            alphaRef.current = 1
            frameRef.current = 0
            userMovedRef.current = false
            dirtyRef.current = true
          }}>{t('graphRelayout')}</button>
          <button className='gv-btn' onClick={() => fitToView(true)}>{t('graphFit')}</button>
          {(selId !== null || selEdge !== null) && (
            <button className='gv-btn' onClick={() => { applySel(null); applySelEdge(null) }}>{t('graphClearSel')}</button>
          )}
        </div>
      </div>
      <div className='gv-legend'>
        {typesUsed.map(([type, count]) => (
          <button key={type} title={type} className={hiddenTypes.has(type) ? 'gv-legend-off' : ''} onClick={() => toggleType(type)}>
            <i style={{ background: typeColor(type) }} />{type} {count}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        style={{ cursor: 'grab' }}
        onPointerDown={e => {
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          const p = toWorld(e.clientX, e.clientY)
          const v = viewRef.current
          dragRef.current = { mode: 'press', id: pickNode(p.x, p.y), sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false }
        }}
        onPointerMove={e => {
          const drag = dragRef.current
          if (drag.mode === 'press') {
            // 按下后位移 >4px 才算拖拽：拖节点 / 平移；否则留着等 pointerup 判点击
            if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
              drag.moved = true
              if (drag.id === null) { const c = canvasRef.current; if (c !== null) c.style.cursor = 'grabbing' }
            }
            if (!drag.moved) return
            if (drag.id !== null) {
              const node = indexRef.current?.byId.get(drag.id)
              const p = toWorld(e.clientX, e.clientY)
              if (node !== undefined) { node.x = p.x; node.y = p.y }
            } else {
              const v = viewRef.current
              viewRef.current = { ...v, x: drag.ox + (e.clientX - drag.sx), y: drag.oy + (e.clientY - drag.sy) }
              userMovedRef.current = true
            }
            dirtyRef.current = true
            return
          }
          // 悬停：节点优先，其次边（边命中仅在足够放大时启用）
          const p = toWorld(e.clientX, e.clientY)
          const rect = canvasRef.current?.getBoundingClientRect()
          const hx = e.clientX - (rect?.left ?? 0)
          const hy = e.clientY - (rect?.top ?? 0)
          const hn = pickNode(p.x, p.y)
          if (hn !== null) {
            if (hoverEdgeRef.current !== null) { hoverEdgeRef.current = null; dirtyRef.current = true }
            if (hoverNodeRef.current !== hn) { hoverNodeRef.current = hn; dirtyRef.current = true }
            const node = indexRef.current?.byId.get(hn)
            if (node !== undefined) showTip(hx, hy, `n${hn}`, `${node.name}（${node.type} · deg ${node.degree}）`)
            const c = canvasRef.current
            if (c !== null) c.style.cursor = 'pointer'
            return
          }
          if (hoverNodeRef.current !== null) { hoverNodeRef.current = null; dirtyRef.current = true }
          const he = pickEdge(p.x, p.y)
          if (hoverEdgeRef.current !== he) { hoverEdgeRef.current = he; dirtyRef.current = true }
          const c = canvasRef.current
          if (c !== null) c.style.cursor = he !== null ? 'pointer' : 'grab'
          if (he !== null) {
            const e2 = dataRef.current?.edges[he]
            const a = e2 !== undefined ? indexRef.current?.byId.get(e2.s) : undefined
            const b = e2 !== undefined ? indexRef.current?.byId.get(e2.t) : undefined
            if (e2 !== undefined && a !== undefined && b !== undefined) showTip(hx, hy, `e${he}`, `${a.name} —${e2.type}→ ${b.name} · w=${e2.weight}`)
          } else clearTip()
        }}
        onPointerUp={e => {
          const drag = dragRef.current
          resetDrag()
          const c = canvasRef.current
          if (c !== null) c.style.cursor = 'grab'
          if (drag.mode !== 'press' || drag.moved) return
          // 纯点击：节点 → 聚焦开关（看详情/邻居）；边 → 关系高亮；空白 → 清除
          if (drag.id !== null) {
            applySelEdge(null)
            applySel(selRef.current === drag.id ? null : drag.id)
          } else {
            const p = toWorld(e.clientX, e.clientY)
            const he = pickEdge(p.x, p.y)
            if (he !== null) {
              applySel(null)
              applySelEdge(selEdgeRef.current === he ? null : he)
            } else {
              applySel(null)
              applySelEdge(null)
            }
          }
        }}
        onPointerLeave={() => { resetDrag(); hoverNodeRef.current = null; hoverEdgeRef.current = null; dirtyRef.current = true; clearTip() }}
      />
      {hoverTip !== null && (
        <div className='gv-graph-tip' style={{ left: hoverTip.x, top: hoverTip.y }}>{hoverTip.text}</div>
      )}
      {selNode !== undefined && (
        <div className='gv-graph-card'>
          <div className='gv-graph-card-head'>
            <span className='gv-name'>{selNode.name}</span>
            <span className='gv-badge'>{selNode.type}</span>
            <span className='gv-badge'>deg {selNode.degree}</span>
            <div className='gv-graph-card-tools'>
              {canLocate && <button className='gv-btn' onClick={() => { document.getElementById(`gv-card-${selNode.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>{t('graphLocate')}</button>}
              <button className='gv-btn' title={t('graphClearSel')} onClick={() => { applySel(null); applySelEdge(null) }}>×</button>
            </div>
          </div>
          <div className='gv-graph-card-body'>
            <div className='gv-cost'>{t('graphNeighbors', { n: selNeighbors.length })}</div>
            {selNeighbors.map((link, i) => {
              const other = index?.byId.get(link.other)
              return (
                <button key={i} className='gv-graph-card-row' disabled={other === undefined} onClick={() => { if (other !== undefined) locateNode(other) }}>
                  <span className='gv-cost'>{link.edge.s === selNode.id ? '→' : '←'}</span>
                  <span className='gv-cost'>{link.edge.type}</span>
                  <span>{other?.name ?? '?'}</span>
                  <span className='gv-cost'>w={link.edge.weight}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className='gv-graph-ctl'>
        <button className='gv-btn' title={t('graphZoomIn')} onClick={() => zoomStep(1.25)}>＋</button>
        <button className='gv-btn' title={t('graphZoomOut')} onClick={() => zoomStep(0.8)}>－</button>
      </div>
      <div className='gv-graph-hint'>{t('graphHint')}</div>
    </div>
  )
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
    if (sel === null || sel.isCollapsed || text.trim().length < 2 || anchor === null || anchor === undefined || anchor.closest('.gv-md, .gv-pre') === null) {
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
