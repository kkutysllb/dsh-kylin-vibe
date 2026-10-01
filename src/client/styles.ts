/** 面板样式：注入一条 <style>（id 幂等），类名 `gv-` 前缀。
 *
 * 双层令牌：局部别名覆盖宿主设计平台令牌（`--dsw-alias-*`，automation
 * 同款），无令牌宿主回落字面量——双主题自适应。布局纪律（super-ppts §7）：
 * 壳层宽度与滚动归宿主，不自建侧边栏/固定栏/100vw/100vh；面板交由宿主
 * main 槽位容器约束，无自建高度。
 */

const STYLE_ID = 'ky-graphrag-styles'

export function installStyles(): () => void {
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}

const CSS = `
.gv-panel, .gv-form, .gv-card {
  --gv-fg: var(--dsw-alias-label-primary, #1f2329);
  --gv-fg-secondary: var(--dsw-alias-label-secondary, #5a6472);
  --gv-fg-muted: var(--dsw-alias-label-tertiary, #8a94a3);
  --gv-layer: var(--dsw-alias-bg-layer-2, transparent);
  --gv-fill: var(--dsw-alias-bg-skeleton, rgba(127,127,127,.14));
  --gv-border: var(--dsw-alias-border-l3, rgba(127,127,127,.3));
  --gv-primary: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #4176e6);
  --gv-primary-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --gv-error: var(--dsw-alias-state-error-primary, #d0403d);
}
.gv-panel { padding: 16px 20px 32px; box-sizing: border-box; font-size: 13px; line-height: 1.5; color: var(--gv-fg); }
.gv-panel h2 { margin: 0 0 4px; font-size: 16px; color: var(--gv-fg); }
.gv-sub { color: var(--gv-fg-secondary); margin: 0 0 12px; }
.gv-notice { background: color-mix(in srgb, var(--gv-primary) 12%, transparent); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.gv-card { border: 1px solid var(--gv-border); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; background: var(--gv-layer); }
.gv-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.gv-name { font-weight: 600; font-size: 14px; color: var(--gv-fg); }
.gv-badge { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--gv-fill); color: var(--gv-fg-secondary); }
.gv-roots { color: var(--gv-fg-muted); font-size: 12px; word-break: break-all; margin: 4px 0; }
.gv-stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; color: var(--gv-fg-muted); font-size: 12px; }
.gv-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.gv-btn { border: 1px solid var(--gv-border); background: transparent; color: var(--gv-fg); border-radius: 8px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
.gv-btn:hover { background: var(--gv-fill); }
.gv-btn:disabled { opacity: .45; cursor: not-allowed; }
.gv-btn-primary { background: var(--gv-primary); border-color: var(--gv-primary); color: var(--gv-primary-fg); }
.gv-btn-danger { color: var(--gv-error); border-color: color-mix(in srgb, var(--gv-error) 50%, transparent); }
.gv-bar { height: 6px; border-radius: 3px; background: var(--gv-fill); overflow: hidden; margin: 6px 0; }
.gv-bar-fill { height: 100%; background: var(--gv-primary); transition: width .4s; }
.gv-current { font-size: 11px; color: var(--gv-fg-muted); word-break: break-all; }
.gv-form { border: 1px dashed var(--gv-border); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
.gv-form label { display: block; margin: 8px 0 4px; font-size: 12px; color: var(--gv-fg-secondary); }
.gv-form input, .gv-form textarea, .gv-search input { width: 100%; box-sizing: border-box; border: 1px solid var(--gv-border); border-radius: 8px; padding: 6px 8px; background: transparent; color: var(--gv-fg); font-size: 13px; font-family: inherit; }
.gv-form textarea { min-height: 56px; resize: vertical; }
.gv-error { color: var(--gv-error); margin: 10px 0; }
.gv-empty { color: var(--gv-fg-muted); padding: 24px 0; text-align: center; }
.gv-cost { font-size: 11px; color: var(--gv-fg-muted); }
.gv-tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.gv-tab-active { background: color-mix(in srgb, var(--gv-primary) 15%, transparent); border-color: var(--gv-primary); }
.gv-search { display: flex; gap: 8px; margin-bottom: 10px; }
.gv-search input { flex: 1; }
.gv-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
.gv-table td { padding: 3px 8px 3px 0; border-top: 1px solid var(--gv-border); color: var(--gv-fg); }
.gv-evidence { margin: 6px 0; }
.gv-pre { background: var(--gv-fill); border-radius: 8px; padding: 8px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: var(--gv-fg); }
`
