window.__ModuleLoader__.load({ id: "dsh-kylin-vibe", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  createKbRuntime: () => createKbRuntime,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/protocol.ts
async function unwrap(promise) {
  const raw = await promise;
  if (raw?.ok === true) return raw.value;
  const code = typeof raw?.error?.code === "string" ? raw.error.code : "unknown";
  const message = typeof raw?.error?.message === "string" ? raw.error.message : String(raw?.error?.code ?? "unknown");
  throw Object.assign(new Error(message), { code });
}

// src/client/runtime.ts
var RPC_CHANNEL = "/dsh-kylin-vibe";
function createKbRuntime(deps) {
  let state = { phase: "idle" };
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const source = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
  let noticeText;
  const noticeListeners = /* @__PURE__ */ new Set();
  const pushNotice = (text) => {
    noticeText = text;
    for (const l of [...noticeListeners]) l();
  };
  const call = async (endpoint, payload) => unwrap(deps.rpc.call(RPC_CHANNEL, endpoint, payload));
  let pollTimer;
  const hasRunning = () => (state.snapshot?.kbs ?? []).some((kb) => kb.progress !== null && kb.progress.phase !== "done" && kb.progress.phase !== "error");
  const tick = () => {
    void refresh().catch(() => {
    });
  };
  const restartPoll = () => {
    if (pollTimer !== void 0) clearInterval(pollTimer);
    pollTimer = setInterval(tick, hasRunning() ? 1200 : 5e3);
  };
  async function refresh() {
    if (state.phase === "idle" || state.phase === "error") publish({ ...state, phase: state.phase === "error" ? "error" : "loading" });
    try {
      const snapshot = await call("snapshot", {});
      const runningBefore = hasRunning();
      publish({ phase: "ready", snapshot, refreshedAt: Date.now() });
      if (hasRunning() !== runningBefore) restartPoll();
    } catch (error) {
      publish({ phase: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }
  const withRefresh = async (action, done, failed) => {
    try {
      await action();
      pushNotice(done);
      await refresh();
    } catch (error) {
      pushNotice(`${failed}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const runtime = {
    rpc: deps.rpc,
    source,
    notice: {
      getSnapshot: () => noticeText,
      subscribe: (listener) => {
        noticeListeners.add(listener);
        return () => {
          noticeListeners.delete(listener);
        };
      }
    },
    pushNotice,
    dismissNotice: () => {
      noticeText = void 0;
      for (const l of [...noticeListeners]) l();
    },
    refresh,
    start: () => {
      void refresh();
      restartPoll();
    },
    stop: () => {
      if (pollTimer !== void 0) {
        clearInterval(pollTimer);
        pollTimer = void 0;
      }
    },
    create: (input) => withRefresh(() => call("createKb", input), `\u77E5\u8BC6\u5E93\u300C${input.name}\u300D\u5DF2\u521B\u5EFA`, "\u521B\u5EFA\u5931\u8D25"),
    update: (input) => withRefresh(() => call("updateKb", input), "\u77E5\u8BC6\u5E93\u5DF2\u66F4\u65B0", "\u66F4\u65B0\u5931\u8D25"),
    remove: (id) => withRefresh(() => call("deleteKb", { id }), "\u77E5\u8BC6\u5E93\u5DF2\u5220\u9664", "\u5220\u9664\u5931\u8D25"),
    startIndex: (id, retryQuarantined = false) => withRefresh(
      () => call("index", { id, retryQuarantined }),
      "\u7D22\u5F15\u5DF2\u542F\u52A8",
      "\u7D22\u5F15\u542F\u52A8\u5931\u8D25"
    ),
    cancel: (id) => withRefresh(() => call("cancel", { id }), "\u5DF2\u8BF7\u6C42\u53D6\u6D88", "\u53D6\u6D88\u5931\u8D25")
  };
  return runtime;
}
function sortKbs(kbs) {
  return [...kbs].sort((a, b) => (b.lastIndexedAt ?? 0) - (a.lastIndexedAt ?? 0) || a.name.localeCompare(b.name));
}

// src/client/styles.ts
function installStyles() {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}
var CSS = `
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
`;

// src/client/view.tsx
var import_react2 = require("react");

// src/client/browse-review.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function BrowseReviewView(props) {
  const { runtime, t, kbId } = props;
  const [tab, setTab] = (0, import_react.useState)("browse");
  const tabs = [
    { kind: "browse", label: t("tabBrowse") },
    { kind: "review", label: t("tabReview") },
    { kind: "health", label: t("tabHealth") }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-tabs", children: [
      tabs.map((x) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: tab === x.kind ? "gv-btn gv-tab-active" : "gv-btn", onClick: () => setTab(x.kind), children: x.label }, x.kind)),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
        className: "gv-btn",
        onClick: () => setTab("browse"),
        /* spacer no-op */
        children: ""
      })
    ] }),
    tab === "browse" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrowseTab, { runtime, t, kbId }),
    tab === "review" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewTab, { runtime, t, kbId }),
    tab === "health" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HealthTab, { runtime, t, kbId })
  ] });
}
function BrowseTab(props) {
  const { runtime, t, kbId } = props;
  const [query, setQuery] = (0, import_react.useState)("");
  const [cards, setCards] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const load = (q) => {
    setLoading(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "browse", { id: kbId, query: q, limit: 30 })).then((v) => setCards(v)).catch((err) => runtime.pushNotice(`${t("loadFailed")}: ${err instanceof Error ? err.message : String(err)}`)).finally(() => setLoading(false));
  };
  (0, import_react.useEffect)(() => {
    load("");
  }, [kbId]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-search", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          value: query,
          placeholder: t("searchPlaceholder"),
          onChange: (e) => setQuery(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter") load(query);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => load(query), children: t("search") })
    ] }),
    loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") }),
    !loading && cards.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("noEntities") }),
    cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: card.name }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-badge", children: card.type }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-badge", children: [
          "deg ",
          card.degree
        ] })
      ] }),
      card.description !== null && card.description !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: card.description }),
      card.neighbors.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", { className: "gv-table", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: card.neighbors.map((nb, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: nb.dir === "out" ? "\u2192" : "\u2190" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: nb.type }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: nb.other }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { className: "gv-cost", children: [
          "w=",
          nb.weight,
          nb.evidence.length > 0 ? ` \xB7 ${nb.evidence[0]?.path}:${nb.evidence[0]?.lines}` : ""
        ] })
      ] }, i)) }) })
    ] }, card.id))
  ] });
}
function ReviewTab(props) {
  const { runtime, t, kbId } = props;
  const [samples, setSamples] = (0, import_react.useState)([]);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [idx, setIdx] = (0, import_react.useState)(0);
  const [done, setDone] = (0, import_react.useState)(0);
  const load = () => {
    setLoading(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "sampleReview", { id: kbId, limit: 20 })).then((v) => {
      setSamples(v);
      setIdx(0);
    }).catch((err) => runtime.pushNotice(`${t("loadFailed")}: ${err instanceof Error ? err.message : String(err)}`)).finally(() => setLoading(false));
  };
  (0, import_react.useEffect)(() => {
    load();
  }, [kbId]);
  const verdict = (v) => {
    const sample = samples[idx];
    if (sample === void 0) return;
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "review", { id: kbId, relationId: sample.id, verdict: v })).then(() => {
      setDone((n) => n + 1);
      if (idx + 1 >= samples.length) load();
      else setIdx(idx + 1);
    }).catch((err) => runtime.pushNotice(String(err)));
  };
  const current = samples[idx];
  if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") });
  if (current === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-empty", children: [
      t("reviewExhausted", { done }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: load, children: t("resample") }) })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gv-sub", children: t("reviewHint", { i: idx + 1, n: samples.length, done }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: current.s }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-badge", children: current.r }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "gv-name", children: current.o }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-badge", children: [
          t("confidence"),
          ": ",
          current.confidence.toFixed(2)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-sub", children: t("reviewQuestion") }),
      current.evidence.map((ev, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-evidence", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-cost", children: [
          ev.path,
          ":",
          ev.startLine,
          "-",
          ev.endLine
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { className: "gv-pre", children: ev.text })
      ] }, i)),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-primary", onClick: () => verdict("correct"), children: t("verdictCorrect") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn gv-btn-danger", onClick: () => verdict("wrong"), children: t("verdictWrong") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "gv-btn", onClick: () => verdict("unsure"), children: t("verdictUnsure") })
      ] })
    ] })
  ] });
}
function HealthTab(props) {
  const { runtime, t, kbId } = props;
  const [report, setReport] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    setLoading(true);
    void unwrap(runtime.rpc.call(RPC_CHANNEL, "health", { id: kbId })).then((v) => setReport(v)).catch((err) => runtime.pushNotice(String(err))).finally(() => setLoading(false));
  }, [kbId]);
  if (loading || report === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-empty", children: t("loading") });
  const pct = (x) => x === null ? t("never") : `${Math.round(x * 100)}%`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "gv-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "gv-card-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "gv-name", children: [
      t("healthTitle"),
      " \u2014 ",
      report.kbName
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", { className: "gv-table", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("coverage") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: pct(report.coverage) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("filesIndexed") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
          report.files.indexed,
          report.files.stale > 0 ? `\uFF08${t("stale")} ${report.files.stale}\uFF09` : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("quarantined") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
          report.files.quarantined,
          report.quarantineRate !== null ? `\uFF08${pct(report.quarantineRate)}\uFF09` : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("samplePrecision") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.samplePrecision === null ? t("never") : `${report.correct}/${report.sampled} = ${pct(report.samplePrecision)}` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("excluded") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: report.excludedRelations })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: t("lastIndex") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: formatAt(report.lastIndexAt) })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "gv-sub", children: t("healthNote") })
  ] });
}
function formatAt(at) {
  if (at === null || at === 0) return "\u2014";
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// src/client/view.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function KbManagerView(props) {
  const { runtime, t } = props;
  const state = (0, import_react2.useSyncExternalStore)(runtime.source.subscribe, runtime.source.getSnapshot);
  const notice = (0, import_react2.useSyncExternalStore)(runtime.notice.subscribe, runtime.notice.getSnapshot);
  (0, import_react2.useEffect)(() => {
    runtime.start();
    return () => runtime.stop();
  }, [runtime]);
  const [formOpen, setFormOpen] = (0, import_react2.useState)(false);
  const kbs = state.snapshot ? sortKbs(state.snapshot.kbs) : [];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: () => setFormOpen((open) => !open), children: formOpen ? t("closeForm") : t("newKb") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "gv-sub", children: t("subtitle") }),
    notice !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-notice", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: notice }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: () => runtime.dismissNotice(), children: t("dismiss") })
    ] }),
    state.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-error", children: [
      t("loadFailed"),
      ": ",
      state.error
    ] }),
    formOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CreateForm, { runtime, t, onDone: () => setFormOpen(false) }),
    state.phase === "ready" && kbs.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-empty", children: t("empty") }),
    kbs.map((kb) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KbCard, { kb, runtime, t }, kb.id))
  ] });
}
function CreateForm(props) {
  const { runtime, t, onDone } = props;
  const [name2, setName] = (0, import_react2.useState)("");
  const [rootsText, setRootsText] = (0, import_react2.useState)("");
  const [description, setDescription] = (0, import_react2.useState)("");
  const submit = () => {
    const roots = rootsText.split("\n").map((line) => line.trim()).filter((line) => line !== "");
    if (name2.trim() === "" || roots.length === 0) return;
    void runtime.create({ name: name2.trim(), roots, description: description.trim() !== "" ? description.trim() : void 0 }).then(onDone);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-form", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("formName") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { value: name2, onChange: (e) => setName(e.target.value), placeholder: t("formNameHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("formRoots") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("textarea", { value: rootsText, onChange: (e) => setRootsText(e.target.value), placeholder: t("formRootsHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: t("formDesc") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { value: description, onChange: (e) => setDescription(e.target.value), placeholder: t("formDescHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-primary", disabled: name2.trim() === "" || rootsText.trim() === "", onClick: submit, children: t("create") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: onDone, children: t("cancel") })
    ] })
  ] });
}
function KbCard(props) {
  const { kb, runtime, t } = props;
  const [exploreOpen, setExploreOpen] = (0, import_react2.useState)(false);
  const progress = kb.progress;
  const running = progress !== null && progress.phase !== "done" && progress.phase !== "error";
  const pct = progress !== null && progress.filesTotal > 0 ? Math.round(progress.filesDone / progress.filesTotal * 100) : running ? 5 : 0;
  const remove = () => {
    if (window.confirm(t("confirmDelete", { name: kb.name }))) void runtime.remove(kb.id);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-name", children: kb.name }),
      kb.managed === "config" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-badge", children: t("managedByConfig") }),
      progress !== null && progress.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-badge", children: t("phaseError") }),
      progress !== null && progress.phase === "done" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "gv-badge", children: t("phaseDone") })
    ] }),
    kb.description !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: kb.description }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-roots", children: kb.roots.join("  \xB7  ") || t("noRoots") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-stats", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("filesIndexed"),
        ": ",
        progress !== null && running ? `${progress.filesDone}/${progress.filesTotal}` : kb.filesIndexed
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("entities"),
        ": ",
        kb.entities
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("relations"),
        ": ",
        kb.relations
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("quarantined"),
        ": ",
        progress?.quarantined ?? 0
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
        t("lastIndex"),
        ": ",
        formatTime(kb.lastIndexedAt, t)
      ] })
    ] }),
    running && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-bar", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-bar-fill", style: { width: `${pct}%` } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-current", children: [
        t("phaseLabel", { phase: progress?.phase ?? "" }),
        progress?.currentFile !== null && progress?.currentFile !== void 0 ? ` \u2014 ${progress.currentFile}` : "",
        " \xB7 ",
        "LLM ",
        progress?.llmCalls ?? 0
      ] })
    ] }),
    progress !== null && progress.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-error", children: progress.error }),
    progress !== null && progress.phase === "done" && progress.report !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "gv-cost", children: t("lastReport", {
      added: progress.report.graphDelta.entitiesAdded,
      relations: progress.report.graphDelta.relationsAdded,
      calls: progress.report.cost.llmCalls
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "gv-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-primary", disabled: running || kb.managed === "config" && kb.roots.length === 0, onClick: () => void runtime.startIndex(kb.id), children: t("index") }),
      running && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-danger", onClick: () => void runtime.cancel(kb.id), children: t("cancelIndex") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn", onClick: () => setExploreOpen((open) => !open), children: exploreOpen ? t("closeExplore") : t("explore") }),
      kb.managed !== "config" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "gv-btn gv-btn-danger", onClick: remove, children: t("delete") })
    ] }),
    exploreOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BrowseReviewView, { runtime, t, kbId: kb.id })
  ] });
}
function formatTime(at, t) {
  if (at === null || at === 0) return t("never");
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var name = "dsh-kylin-vibe";
var inject = ["slots", "connection"];
var PANEL_ID = "ky-graphrag";
var DICT = {
  zh: {
    nav: "\u77E5\u8BC6\u56FE\u8C31",
    title: "\u77E5\u8BC6\u56FE\u8C31",
    subtitle: "\u628A\u6388\u6743\u8BED\u6599\u7D22\u5F15\u6210\u5B9E\u4F53-\u5173\u7CFB-\u793E\u533A\u56FE\u8C31\uFF1Bagent \u53EF\u7ECF graphrag_* \u5DE5\u5177\u68C0\u7D22\u3002",
    newKb: "\u65B0\u5EFA\u77E5\u8BC6\u5E93",
    closeForm: "\u6536\u8D77",
    dismiss: "\u77E5\u9053\u4E86",
    loadFailed: "\u52A0\u8F7D\u5931\u8D25",
    empty: "\u8FD8\u6CA1\u6709\u77E5\u8BC6\u5E93\u3002\u70B9\u51FB\u53F3\u4E0A\u89D2\u300C\u65B0\u5EFA\u77E5\u8BC6\u5E93\u300D\u5F00\u59CB\u3002",
    formName: "\u540D\u79F0",
    formNameHint: "\u4F8B\u5982\uFF1Aatlas \u4EE3\u7801\u5E93",
    formRoots: "\u6388\u6743\u76EE\u5F55\uFF08\u6BCF\u884C\u4E00\u4E2A\u7EDD\u5BF9\u8DEF\u5F84\uFF09",
    formRootsHint: "/Users/me/projects/atlas",
    formDesc: "\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09",
    formDescHint: "\u8FD9\u4EFD\u8BED\u6599\u7684\u7528\u9014",
    create: "\u521B\u5EFA",
    cancel: "\u53D6\u6D88",
    managedByConfig: "\u914D\u7F6E\u6258\u7BA1",
    phaseError: "\u51FA\u9519",
    phaseDone: "\u5B8C\u6210",
    noRoots: "\uFF08\u672A\u914D\u7F6E\u6388\u6743\u76EE\u5F55\uFF09",
    filesIndexed: "\u5DF2\u7D22\u5F15\u6587\u4EF6",
    entities: "\u5B9E\u4F53",
    relations: "\u5173\u7CFB",
    tabBrowse: "\u6D4F\u89C8",
    tabReview: "\u51C6\u786E\u6027\u62BD\u67E5",
    tabHealth: "\u4F53\u68C0\u62A5\u544A",
    searchPlaceholder: "\u641C\u7D22\u5B9E\u4F53\uFF08Enter \u68C0\u7D22\uFF09",
    search: "\u68C0\u7D22",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    noEntities: "\u6CA1\u6709\u547D\u4E2D\u7684\u5B9E\u4F53\u3002",
    reviewHint: "\u7B2C {i}/{n} \u6761\uFF08\u5DF2\u5B8C\u6210 {done}\uFF09\uFF1A\u8FD9\u6761\u5173\u7CFB\u5728\u539F\u6587\u4E2D\u6210\u7ACB\u5417\uFF1F",
    reviewQuestion: "\u4EE5\u4E0B\u539F\u6587\u662F\u5426\u652F\u6301\u8FD9\u6761\u5173\u7CFB\uFF1F",
    confidence: "\u7F6E\u4FE1\u5EA6",
    verdictCorrect: "\u6B63\u786E",
    verdictWrong: "\u9519\u8BEF",
    verdictUnsure: "\u5B58\u7591",
    resample: "\u91CD\u65B0\u62BD\u6837",
    reviewExhausted: '\u672C\u8F6E\u62BD\u67E5\u5B8C\u6210\uFF08{done} \u6761\uFF09\u3002\u6807\u8BB0\u4E3A"\u9519\u8BEF"\u7684\u5173\u7CFB\u5DF2\u5728\u68C0\u7D22\u4E2D\u6392\u9664\u3002',
    healthTitle: "\u4F53\u68C0\u62A5\u544A",
    coverage: "\u6587\u4EF6\u8986\u76D6\u7387",
    stale: "\u9648\u65E7",
    samplePrecision: "\u62BD\u6837\u7CBE\u786E\u7387",
    excluded: "\u5DF2\u6392\u9664\u5173\u7CFB",
    healthNote: '\u8986\u76D6\u7387\u4E3A\u5DF2\u7D22\u5F15/\u53D7\u626B\u6587\u4EF6\u6BD4\uFF1B\u62BD\u6837\u7CBE\u786E\u7387\u6765\u81EA"\u51C6\u786E\u6027\u62BD\u67E5"\u7684\u4EBA\u5DE5\u5224\u5B9A\uFF1B\u6807\u8BB0\u9519\u8BEF\u7684\u5173\u7CFB\u4E0D\u518D\u53C2\u4E0E\u68C0\u7D22\u3002',
    explore: "\u6D4F\u89C8 / \u5BA1\u67E5",
    closeExplore: "\u6536\u8D77",
    quarantined: "\u9694\u79BB",
    lastIndex: "\u6700\u540E\u7D22\u5F15",
    never: "\u4ECE\u672A",
    phaseLabel: "\u9636\u6BB5",
    lastReport: "\u4E0A\u6B21\uFF1A+{added} \u5B9E\u4F53 / +{relations} \u5173\u7CFB / {calls} \u6B21 LLM",
    index: "\u7D22\u5F15",
    cancelIndex: "\u53D6\u6D88\u7D22\u5F15",
    delete: "\u5220\u9664",
    confirmDelete: "\u5220\u9664\u77E5\u8BC6\u5E93\u300C{name}\u300D\uFF1F\u56FE\u8C31\u6570\u636E\u5C06\u88AB\u6E05\u9664\u3002",
    channelUnavailable: "\u77E5\u8BC6\u56FE\u8C31\u901A\u9053\u4E0D\u53EF\u7528 (the graphrag channel is unavailable)",
    createDone: "\u521B\u5EFA\u6210\u529F",
    createFailed: "\u521B\u5EFA\u5931\u8D25",
    updateDone: "\u5DF2\u66F4\u65B0",
    updateFailed: "\u66F4\u65B0\u5931\u8D25",
    deleteDone: "\u5DF2\u5220\u9664",
    deleteFailed: "\u5220\u9664\u5931\u8D25",
    indexStarted: "\u7D22\u5F15\u5DF2\u542F\u52A8",
    indexFailed: "\u7D22\u5F15\u542F\u52A8\u5931\u8D25",
    cancelDone: "\u5DF2\u8BF7\u6C42\u53D6\u6D88",
    cancelFailed: "\u53D6\u6D88\u5931\u8D25"
  },
  en: {
    nav: "Knowledge Graph",
    title: "Knowledge Graph",
    subtitle: "Index authorized corpora into entity-relation-community graphs; agents retrieve via graphrag_* tools.",
    newKb: "New Knowledge Base",
    closeForm: "Close",
    dismiss: "Got it",
    loadFailed: "Load failed",
    empty: 'No knowledge bases yet. Click "New Knowledge Base" to start.',
    formName: "Name",
    formNameHint: "e.g. atlas codebase",
    formRoots: "Authorized directories (one absolute path per line)",
    formRootsHint: "/Users/me/projects/atlas",
    formDesc: "Description (optional)",
    formDescHint: "What this corpus is for",
    create: "Create",
    cancel: "Cancel",
    managedByConfig: "config-managed",
    phaseError: "error",
    phaseDone: "done",
    noRoots: "(no authorized directories)",
    filesIndexed: "Files indexed",
    entities: "Entities",
    relations: "Relations",
    tabBrowse: "Browse",
    tabReview: "Accuracy Review",
    tabHealth: "Health Report",
    searchPlaceholder: "Search entities (Enter to run)",
    search: "Search",
    loading: "Loading\u2026",
    noEntities: "No entities matched.",
    reviewHint: "Sample {i}/{n} ({done} done): does this relation hold in the source text?",
    reviewQuestion: "Does the following source text support this relation?",
    confidence: "confidence",
    verdictCorrect: "Correct",
    verdictWrong: "Wrong",
    verdictUnsure: "Unsure",
    resample: "Resample",
    reviewExhausted: "Review round complete ({done} judged). Relations marked wrong are excluded from retrieval.",
    healthTitle: "Health Report",
    coverage: "File coverage",
    stale: "stale",
    samplePrecision: "Sample precision",
    excluded: "Excluded relations",
    healthNote: "Coverage = indexed / scanned files; sample precision comes from human verdicts in Accuracy Review; wrong-marked relations are excluded from retrieval.",
    explore: "Browse / Review",
    closeExplore: "Collapse",
    quarantined: "Quarantined",
    lastIndex: "Last index",
    never: "never",
    phaseLabel: "Phase",
    lastReport: "Last: +{added} entities / +{relations} relations / {calls} LLM calls",
    index: "Index",
    cancelIndex: "Cancel",
    delete: "Delete",
    confirmDelete: 'Delete knowledge base "{name}"? Graph data will be removed.',
    channelUnavailable: "The graphrag channel is unavailable",
    createDone: "Created",
    createFailed: "Create failed",
    updateDone: "Updated",
    updateFailed: "Update failed",
    deleteDone: "Deleted",
    deleteFailed: "Delete failed",
    indexStarted: "Indexing started",
    indexFailed: "Index failed to start",
    cancelDone: "Cancellation requested",
    cancelFailed: "Cancel failed"
  }
};
function translator(lang) {
  const table = DICT[lang];
  const fallback = DICT.zh;
  return (key, params) => {
    const template = table[key] ?? fallback[key] ?? key;
    if (params === void 0) return template;
    return template.replace(/\{(\w+)\}/g, (_m, name2) => String(params[name2] ?? `{${name2}}`));
  };
}
function browserLang() {
  try {
    const languages = navigator.languages ?? [navigator.language];
    return (languages[0] ?? "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch {
    return "zh";
  }
}
function apply(ctx) {
  const disposeStyles = installStyles();
  const runtime = createKbRuntime({
    rpc: {
      call: (channel, endpoint, payload) => {
        if (ctx.connection?.rpc === void 0) {
          return Promise.reject(new Error(DICT.zh.channelUnavailable));
        }
        return ctx.connection.rpc.call(channel, endpoint, payload);
      }
    }
  });
  const t = translator(browserLang());
  if (ctx.slots?.inject !== void 0) {
    try {
      ctx.slots.inject("sidebar.panellist", () => {
        const disposeIcon = ctx.slots.register({
          name: "sidebar.panellist",
          id: PANEL_ID,
          order: 125,
          label: t("nav")
        }, PanelIcon);
        const disposePanel = ctx.slots.register({
          name: "main",
          key: PANEL_ID
        }, function KbManagerMount() {
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(KbManagerView, { runtime, t });
        });
        return () => {
          disposePanel();
          disposeIcon();
        };
      });
    } catch (error) {
      console.warn("[dsh-kylin-vibe] sidebar/main slot registration skipped:", error);
    }
  }
  ctx.effect(() => disposeStyles, "ky-graphrag: styles");
}
function PanelIcon(props) {
  const size = props.size ?? 18;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "9", cy: "10", r: "2.2" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "15", cy: "9", r: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("circle", { cx: "13.5", cy: "15", r: "2.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M10.8 11.4 12 13" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M14.2 9.8 14 12.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("path", { d: "M11 10 13.3 9.3" })
  ] });
}
return module.exports; } });
//# sourceMappingURL=client.js.map
