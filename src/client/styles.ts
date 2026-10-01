/** 面板样式：注入一条 <style>，类名带 gv- 前缀避免与宿主冲突。 */

export function installStyles(): () => void {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}

const CSS = `
.gv-tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.gv-tab-active { background: rgba(47,111,235,.15); border-color: #2f6feb; }
.gv-search { display: flex; gap: 8px; margin-bottom: 10px; }
.gv-search input { flex: 1; border: 1px solid var(--kv-border, rgba(128,128,128,.35)); border-radius: 6px; padding: 6px 8px; background: transparent; color: inherit; font-size: 13px; }
.gv-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
.gv-table td { padding: 3px 8px 3px 0; border-top: 1px solid var(--kv-border, rgba(128,128,128,.15)); }
.gv-evidence { margin: 6px 0; }
.gv-pre { background: rgba(128,128,128,.08); border-radius: 6px; padding: 8px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
.gv-panel { padding: 16px; overflow-y: auto; height: 100%; box-sizing: border-box; font-size: 13px; }
.gv-panel h2 { margin: 0 0 4px; font-size: 16px; }
.gv-sub { color: var(--kv-text-secondary, #888); margin: 0 0 12px; }
.gv-notice { background: rgba(64,150,238,.12); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; gap: 8px; }
.gv-card { border: 1px solid var(--kv-border, rgba(128,128,128,.25)); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.gv-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.gv-name { font-weight: 600; font-size: 14px; }
.gv-badge { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: rgba(128,128,128,.18); }
.gv-roots { color: var(--kv-text-secondary, #888); font-size: 12px; word-break: break-all; margin: 4px 0; }
.gv-stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; color: var(--kv-text-secondary, #aaa); font-size: 12px; }
.gv-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.gv-btn { border: 1px solid var(--kv-border, rgba(128,128,128,.35)); background: transparent; color: inherit; border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 12px; }
.gv-btn:hover { background: rgba(128,128,128,.12); }
.gv-btn:disabled { opacity: .45; cursor: not-allowed; }
.gv-btn-primary { background: #2f6feb; border-color: #2f6feb; color: #fff; }
.gv-btn-danger { color: #e5534b; border-color: rgba(229,83,75,.5); }
.gv-bar { height: 6px; border-radius: 3px; background: rgba(128,128,128,.2); overflow: hidden; margin: 6px 0; }
.gv-bar-fill { height: 100%; background: #2f6feb; transition: width .4s; }
.gv-current { font-size: 11px; color: var(--kv-text-secondary, #888); word-break: break-all; }
.gv-form { border: 1px dashed var(--kv-border, rgba(128,128,128,.4)); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.gv-form label { display: block; margin: 8px 0 4px; font-size: 12px; color: var(--kv-text-secondary, #888); }
.gv-form input, .gv-form textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--kv-border, rgba(128,128,128,.35)); border-radius: 6px; padding: 6px 8px; background: transparent; color: inherit; font-size: 13px; font-family: inherit; }
.gv-form textarea { min-height: 56px; resize: vertical; }
.gv-error { color: #e5534b; margin: 10px 0; }
.gv-empty { color: var(--kv-text-secondary, #888); padding: 24px 0; text-align: center; }
.gv-cost { font-size: 11px; color: var(--kv-text-secondary, #888); }
`
