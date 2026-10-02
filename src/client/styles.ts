/** 面板样式：注入一条 <style>（id 幂等），类名 `gv-` 前缀。
 *
 * 双层令牌：局部别名覆盖宿主设计平台令牌（`--dsw-alias-*`，automation
 * 同款），无令牌宿主回落字面量——双主题自适应。布局纪律（automation 同款）：
 * 壳层宽度归宿主；滚动在面板内（0.2.0-rc.2 实测宿主 main 槽位
 * `overflow: hidden` 定高，不滚动，面板必须自带 overflow-y）。
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
.gv-panel { height: 100%; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 16px 20px 32px; box-sizing: border-box; font-size: 13px; line-height: 1.5; color: var(--gv-fg); }
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
.gv-actions + .gv-actions { margin-top: 10px; }
.gv-actions { row-gap: 6px; }
.gv-btn { border: 1px solid var(--gv-border); background: transparent; color: var(--gv-fg); border-radius: 8px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
.gv-btn:hover { background: var(--gv-fill); }
.gv-btn:disabled { opacity: .45; cursor: not-allowed; }
.gv-btn-primary { background: var(--gv-primary); border-color: var(--gv-primary); color: var(--gv-primary-fg); }
.gv-btn-danger { color: var(--gv-error); border-color: color-mix(in srgb, var(--gv-error) 50%, transparent); }
.gv-bar { height: 6px; border-radius: 3px; background: var(--gv-fill); overflow: hidden; margin: 6px 0; }
.gv-bar-fill { height: 100%; background: var(--gv-primary); transition: width .4s; }
.gv-current { font-size: 11px; color: var(--gv-fg-muted); word-break: break-all; }
.gv-form { border: 1px dashed var(--gv-border); border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
.gv-form label, .gv-card label { display: block; margin: 8px 0 4px; font-size: 12px; color: var(--gv-fg-secondary); }
.gv-form input, .gv-card input, .gv-form textarea, .gv-card textarea, .gv-search input { width: 100%; box-sizing: border-box; border: 1px solid var(--gv-border); border-radius: 8px; padding: 6px 8px; background: transparent; color: var(--gv-fg); font-size: 13px; font-family: inherit; }
.gv-select { width: 100%; box-sizing: border-box; border: 1px solid var(--gv-border); border-radius: 8px; padding: 6px 8px; background: transparent; color: var(--gv-fg); font-size: 12px; font-family: inherit; }
.gv-select option { color: #1f2329; background: #fff; }
.gv-form textarea, .gv-card textarea { min-height: 56px; resize: vertical; }
.gv-error { color: var(--gv-error); margin: 10px 0; }
.gv-empty { color: var(--gv-fg-muted); padding: 24px 0; text-align: center; }
.gv-cost { font-size: 11px; color: var(--gv-fg-muted); }
.gv-tabs { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.gv-tab-active { background: color-mix(in srgb, var(--gv-primary) 15%, transparent); border-color: var(--gv-primary); }
.gv-search { display: flex; gap: 8px; margin-bottom: 10px; }
.gv-search input { flex: 1; }
.gv-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
.gv-table td { padding: 3px 8px 3px 0; border-top: 1px solid var(--gv-border); color: var(--gv-fg); }
.gv-evidence { margin: 6px 0; }
.gv-md { max-height: 420px; overflow-y: auto; font-size: 12px; }
.gv-selchip { position: fixed; z-index: 90; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.gv-pre { background: var(--gv-fill); border-radius: 8px; padding: 8px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: var(--gv-fg); }
.gv-split { display: flex; gap: 6px; align-items: flex-start; }
.gv-split-left { flex: 1 1 0; min-width: 0; }
.gv-split-divider { flex: 0 0 6px; align-self: stretch; cursor: col-resize; border-radius: 3px; background: transparent; touch-action: none; }
.gv-split-divider:hover, .gv-split-divider[data-drag='1'] { background: var(--gv-fill); }
.gv-split-right { flex: 0 0 44%; position: sticky; top: 0; min-width: 280px; }
.gv-graph { border: 1px solid var(--gv-border); border-radius: 10px; background: rgba(127,127,127,.05); height: 78vh; max-height: 860px; min-height: 420px; position: relative; overflow: hidden; }
.gv-graph canvas { display: block; cursor: grab; }
.gv-graph-head { position: absolute; top: 8px; left: 10px; right: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; z-index: 5; pointer-events: none; }
.gv-graph-head .gv-name { font-size: 12px; }
.gv-graph-head .gv-actions, .gv-graph-head .gv-graph-search { pointer-events: auto; }
.gv-graph-head .gv-actions { margin: 0 0 0 auto; flex-wrap: wrap; }
.gv-graph-head .gv-btn { padding: 1px 8px; font-size: 11px; }
.gv-graph-search { position: relative; }
.gv-graph-search input { width: 160px; padding: 2px 8px; font-size: 11px; border-radius: 999px; }
.gv-graph-searchlist { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 6; background: var(--dsw-alias-bg-layer-3, #fff); border: 1px solid var(--gv-border); border-radius: 8px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 14px rgba(0,0,0,.15); }
.gv-graph-searchlist button { display: block; width: 100%; text-align: left; padding: 4px 8px; background: transparent; border: none; cursor: pointer; color: #1f2329; font-size: 11px; }
.gv-graph-searchlist button:hover { background: rgba(127,127,127,.14); }
.gv-graph-search-empty { display: block; padding: 6px 8px; font-size: 11px; color: #5a6472; }
.gv-legend { position: absolute; top: 30px; left: 10px; display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 10.5px; color: var(--gv-fg-muted); max-width: 70%; z-index: 2; align-items: center; }
.gv-legend button { display: inline-flex; align-items: center; border: none; background: transparent; color: inherit; font: inherit; padding: 0; cursor: pointer; }
.gv-legend button:hover { color: var(--gv-fg); }
.gv-legend button.gv-legend-off { opacity: .35; text-decoration: line-through; }
.gv-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.gv-graph-tip { position: absolute; z-index: 6; max-width: 340px; background: rgba(22,24,29,.92); color: #f2f4f7; font-size: 11px; line-height: 1.4; padding: 5px 8px; border-radius: 6px; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.25); word-break: break-all; }
.gv-graph-card { position: absolute; top: 56px; right: 10px; width: 250px; max-height: 58%; display: flex; flex-direction: column; border: 1px solid var(--gv-border); border-radius: 10px; background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2, rgba(127,127,127,.08))); box-shadow: 0 4px 14px rgba(0,0,0,.15); z-index: 4; font-size: 12px; }
.gv-graph-card-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 8px 10px 6px; border-bottom: 1px solid var(--gv-border); }
.gv-graph-card-tools { margin-left: auto; display: flex; gap: 4px; }
.gv-graph-card-tools .gv-btn { padding: 0 6px; font-size: 12px; line-height: 1.4; }
.gv-graph-card-body { overflow-y: auto; padding: 6px 8px 8px; }
.gv-graph-card-row { display: flex; align-items: baseline; gap: 6px; width: 100%; text-align: left; border: none; background: transparent; color: var(--gv-fg); padding: 3px 4px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; }
.gv-graph-card-row:hover { background: var(--gv-fill); }
.gv-graph-card-row:disabled { cursor: default; opacity: .5; }
.gv-graph-card-row span:nth-child(3) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gv-graph-ctl { position: absolute; right: 10px; bottom: 26px; display: flex; flex-direction: column; gap: 4px; z-index: 3; }
.gv-graph-ctl .gv-btn { padding: 0 8px; font-size: 13px; line-height: 1.5; background: var(--gv-layer); }
.gv-graph-hint { position: absolute; bottom: 6px; right: 10px; font-size: 10px; color: var(--gv-fg-muted); pointer-events: none; }
`
