/** Client 入口：侧边栏菜单项（官方 `sidebar.panellist` 槽位）+ 独立主面板
 * （官方 `main` keyed 槽位）。外壳负责按钮/激活态/面板切换；本插件只贡献
 * 图标与页面。bundle 经 window.__ModuleLoader__.load 装载（CJS 模块表契约）。
 *
 * 双语：词典经宿主 `locale` 服务注册（`kyGraph` 命名空间）+ `bind` 拿活翻译
 * 器——语言跟随引擎设置自适应（automation 同款），无 locale 服务的宿主回落
 * 内置 zh 词典。槽位元数据带 `locale: NS` + `label: () => t('nav')`（活函数，
 * 侧边栏标签随语言切换即时跟随）。
 */

import type { ClientContext } from './protocol-client.ts'
import { dictionaries, NS, zh } from './locales.ts'
import { createHostBridge } from './bridge.ts'
import { createKbRuntime, type Translate } from './runtime.ts'
import { installStyles } from './styles.ts'
import { KbManagerView } from './view.tsx'

export const name = 'dsh-kylin-vibe'

/** 客户端服务注入面（外壳按此名单注入；缺省会激活失败——0.2.0 实测）。
 * sessions/uiWorkspace/workspaces/remote/modelDirectories/layout 为软探测：
 * 缺席时目录选择、代建落点工作区、模型选择等能力逐级降级，面板主体不受影响。
 */
export const inject = [
  'slots',
  'connection',
  'locale',
  'sessions',
  'uiWorkspace',
  'workspaces',
  'remote',
  'remote.session',
  'modelDirectories',
  'layout',
] as const

/** 面板 id：侧边栏入口与主面板共用。 */
const PANEL_ID = 'ky-graphrag'

/** locale 服务缺席时的兜底：内置 zh 词典（超集覆盖全部键）。 */
function fallbackTranslator(lang: 'zh' | 'en'): Translate {
  return (key, params) => {
    const table = lang === 'en' ? dictionaries.en : zh
    const template = table[key as keyof typeof zh] ?? zh[key as keyof typeof zh] ?? key
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

  // 词典先行：bind 返回的活翻译器以 zh 条目兜底缺失键。
  const localeService = ctx.locale
  if (localeService?.register !== undefined) {
    ctx.effect(
      () => localeService.register(NS, { zh: { ...zh }, en: { ...dictionaries.en } }),
      'ky-graphrag: dictionaries',
    )
  }
  const t: Translate = localeService?.bind !== undefined
    ? localeService.bind(NS)
    : fallbackTranslator(browserLang())

  const runtime = createKbRuntime({
    rpc: {
      call: (channel, endpoint, payload) => {
        if (ctx.connection?.rpc === undefined) {
          return Promise.reject(new Error(t('channelUnavailable')))
        }
        return ctx.connection.rpc.call(channel, endpoint, payload)
      },
    },
    bridge: createHostBridge({
      sessions: ctx.sessions,
      uiWorkspace: ctx.uiWorkspace,
      workspaces: ctx.workspaces,
      remote: ctx.remote,
      modelDirectories: ctx.modelDirectories,
      layout: ctx.layout,
    }),
    t,
  })

  const slots = ctx.slots
  if (slots?.inject !== undefined) {
    try {
      slots.inject('sidebar.panellist', () => {
        const disposeIcon = slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 125,
          label: () => t('nav'),
          locale: NS,
        }, PanelIcon)
        const disposePanel = slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, function KbManagerMount(): React.ReactElement {
          return <KbManagerView runtime={runtime} t={t} bridge={runtime.bridge} />
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
