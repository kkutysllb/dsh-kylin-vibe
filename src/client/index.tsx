/** Client 入口：侧边栏菜单项（官方 `sidebar.panellist` 槽位）+ 独立主面板
 * （官方 `main` keyed 槽位）。外壳负责按钮/激活态/面板切换；本插件只贡献
 * 图标与页面。bundle 经 window.__ModuleLoader__.load 装载（CJS 模块表契约）。
 */

import type { ClientContext } from './protocol-client.ts'
import { createKbRuntime, type Translate } from './runtime.ts'
import { installStyles } from './styles.ts'
import { KbManagerView } from './view.tsx'

export const name = 'dsh-kylin-vibe'

/** 客户端服务注入面（外壳按此名单注入；缺省会激活失败——0.2.0 实测）。 */
export const inject = ['slots', 'connection'] as const

/** 面板 id：侧边栏入口与主面板共用。 */
const PANEL_ID = 'ky-graphrag'

const DICT = {
  zh: {
    nav: '知识图谱',
    title: '知识图谱',
    subtitle: '把授权语料索引成实体-关系-社区图谱；agent 可经 graphrag_* 工具检索。',
    newKb: '新建知识库',
    closeForm: '收起',
    dismiss: '知道了',
    loadFailed: '加载失败',
    empty: '还没有知识库。点击右上角「新建知识库」开始。',
    formName: '名称',
    formNameHint: '例如：atlas 代码库',
    formRoots: '授权目录（每行一个绝对路径）',
    formRootsHint: '/Users/me/projects/atlas',
    formDesc: '描述（可选）',
    formDescHint: '这份语料的用途',
    create: '创建',
    cancel: '取消',
    managedByConfig: '配置托管',
    phaseError: '出错',
    phaseDone: '完成',
    noRoots: '（未配置授权目录）',
    filesIndexed: '已索引文件',
    entities: '实体',
    relations: '关系',
    tabBrowse: '浏览',
    tabReview: '准确性抽查',
    tabHealth: '体检报告',
    searchPlaceholder: '搜索实体（Enter 检索）',
    search: '检索',
    loading: '加载中…',
    noEntities: '没有命中的实体。',
    reviewHint: '第 {i}/{n} 条（已完成 {done}）：这条关系在原文中成立吗？',
    reviewQuestion: '以下原文是否支持这条关系？',
    confidence: '置信度',
    verdictCorrect: '正确',
    verdictWrong: '错误',
    verdictUnsure: '存疑',
    resample: '重新抽样',
    reviewExhausted: '本轮抽查完成（{done} 条）。标记为"错误"的关系已在检索中排除。',
    healthTitle: '体检报告',
    coverage: '文件覆盖率',
    stale: '陈旧',
    samplePrecision: '抽样精确率',
    excluded: '已排除关系',
    healthNote: '覆盖率为已索引/受扫文件比；抽样精确率来自"准确性抽查"的人工判定；标记错误的关系不再参与检索。',
    explore: '浏览 / 审查',
    closeExplore: '收起',
    quarantined: '隔离',
    lastIndex: '最后索引',
    never: '从未',
    phaseLabel: '阶段',
    lastReport: '上次：+{added} 实体 / +{relations} 关系 / {calls} 次 LLM',
    index: '索引',
    cancelIndex: '取消索引',
    delete: '删除',
    confirmDelete: '删除知识库「{name}」？图谱数据将被清除。',
    channelUnavailable: '知识图谱通道不可用 (the graphrag channel is unavailable)',
    createDone: '创建成功',
    createFailed: '创建失败',
    updateDone: '已更新',
    updateFailed: '更新失败',
    deleteDone: '已删除',
    deleteFailed: '删除失败',
    indexStarted: '索引已启动',
    indexFailed: '索引启动失败',
    cancelDone: '已请求取消',
    cancelFailed: '取消失败',
  },
  en: {
    nav: 'Knowledge Graph',
    title: 'Knowledge Graph',
    subtitle: 'Index authorized corpora into entity-relation-community graphs; agents retrieve via graphrag_* tools.',
    newKb: 'New Knowledge Base',
    closeForm: 'Close',
    dismiss: 'Got it',
    loadFailed: 'Load failed',
    empty: 'No knowledge bases yet. Click "New Knowledge Base" to start.',
    formName: 'Name',
    formNameHint: 'e.g. atlas codebase',
    formRoots: 'Authorized directories (one absolute path per line)',
    formRootsHint: '/Users/me/projects/atlas',
    formDesc: 'Description (optional)',
    formDescHint: 'What this corpus is for',
    create: 'Create',
    cancel: 'Cancel',
    managedByConfig: 'config-managed',
    phaseError: 'error',
    phaseDone: 'done',
    noRoots: '(no authorized directories)',
    filesIndexed: 'Files indexed',
    entities: 'Entities',
    relations: 'Relations',
    tabBrowse: 'Browse',
    tabReview: 'Accuracy Review',
    tabHealth: 'Health Report',
    searchPlaceholder: 'Search entities (Enter to run)',
    search: 'Search',
    loading: 'Loading…',
    noEntities: 'No entities matched.',
    reviewHint: 'Sample {i}/{n} ({done} done): does this relation hold in the source text?',
    reviewQuestion: 'Does the following source text support this relation?',
    confidence: 'confidence',
    verdictCorrect: 'Correct',
    verdictWrong: 'Wrong',
    verdictUnsure: 'Unsure',
    resample: 'Resample',
    reviewExhausted: 'Review round complete ({done} judged). Relations marked wrong are excluded from retrieval.',
    healthTitle: 'Health Report',
    coverage: 'File coverage',
    stale: 'stale',
    samplePrecision: 'Sample precision',
    excluded: 'Excluded relations',
    healthNote: 'Coverage = indexed / scanned files; sample precision comes from human verdicts in Accuracy Review; wrong-marked relations are excluded from retrieval.',
    explore: 'Browse / Review',
    closeExplore: 'Collapse',
    quarantined: 'Quarantined',
    lastIndex: 'Last index',
    never: 'never',
    phaseLabel: 'Phase',
    lastReport: 'Last: +{added} entities / +{relations} relations / {calls} LLM calls',
    index: 'Index',
    cancelIndex: 'Cancel',
    delete: 'Delete',
    confirmDelete: 'Delete knowledge base "{name}"? Graph data will be removed.',
    channelUnavailable: 'The graphrag channel is unavailable',
    createDone: 'Created',
    createFailed: 'Create failed',
    updateDone: 'Updated',
    updateFailed: 'Update failed',
    deleteDone: 'Deleted',
    deleteFailed: 'Delete failed',
    indexStarted: 'Indexing started',
    indexFailed: 'Index failed to start',
    cancelDone: 'Cancellation requested',
    cancelFailed: 'Cancel failed',
  },
} as const

type Dict = typeof DICT.zh

function translator(lang: 'zh' | 'en'): Translate {
  const table = DICT[lang] as unknown as Dict
  const fallback = DICT.zh as unknown as Dict
  return (key, params) => {
    const template = (table[key as keyof Dict] ?? fallback[key as keyof Dict] ?? key) as string
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (_m, name: string) => String(params[name] ?? `{${name}}`))
  }
}

function browserLang(): 'zh' | 'en' {
  try {
    const languages = navigator.languages ?? [navigator.language]
    return (languages[0] ?? 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en'
  } catch {
    return 'zh'
  }
}

export function apply(ctx: ClientContext): void {
  const disposeStyles = installStyles()
  const runtime = createKbRuntime({
    rpc: {
      call: (channel, endpoint, payload) => {
        if (ctx.connection?.rpc === undefined) {
          return Promise.reject(new Error(DICT.zh.channelUnavailable))
        }
        return ctx.connection.rpc.call(channel, endpoint, payload)
      },
    },
  })
  const t = translator(browserLang())

  if (ctx.slots?.inject !== undefined) {
    try {
      ctx.slots.inject('sidebar.panellist', () => {
        const disposeIcon = ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 125,
          label: t('nav'),
        }, PanelIcon)
        const disposePanel = ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
        }, function KbManagerMount(): React.ReactElement {
          return <KbManagerView runtime={runtime} t={t} />
        })
        return () => { disposePanel(); disposeIcon() }
      })
    } catch (error) {
      console.warn('[dsh-kylin-vibe] sidebar/main slot registration skipped:', error)
    }
  }

  ctx.effect(() => disposeStyles, 'ky-graphrag: styles')
}

function PanelIcon(props: { size?: number }): React.ReactElement {
  const size = props.size ?? 18
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.9} strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      <circle cx='12' cy='12' r='9' />
      <circle cx='9' cy='10' r='2.2' />
      <circle cx='15' cy='9' r='1.8' />
      <circle cx='13.5' cy='15' r='2.4' />
      <path d='M10.8 11.4 12 13' />
      <path d='M14.2 9.8 14 12.8' />
      <path d='M11 10 13.3 9.3' />
    </svg>
  )
}

export { createKbRuntime } from './runtime.ts'
