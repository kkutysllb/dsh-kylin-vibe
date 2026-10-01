import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// src/provider.ts
import { mkdirSync as mkdirSync2, realpathSync as realpathSync2, rmSync as rmSync2 } from "node:fs";

// src/adapter.ts
import { homedir } from "node:os";
import { join } from "node:path";

// src/core/types.ts
var ENTITY_TYPES = [
  "module",
  "file",
  "function",
  "class",
  "type",
  "concept",
  "config",
  "cli",
  "api",
  "external_dependency",
  "test"
];
var RELATION_TYPES = [
  "defines",
  "uses",
  "calls",
  "imports",
  "depends_on",
  "configures",
  "tests",
  "relates_to"
];
function normName(name2) {
  return name2.trim().toLowerCase().replace(/[\s`*_\-./\\()[\]{}<>"'!?,;:]+/g, "");
}
var GraphRagError = class extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.code = code;
    this.name = "GraphRagError";
  }
  code;
};

// src/adapter.ts
function resolveDataDir(configured, env = process.env) {
  if (configured !== void 0 && configured !== "") return configured;
  const fromEnv = env["GRAPHRAG_DATA_DIR"];
  if (fromEnv !== void 0 && fromEnv !== "") return fromEnv;
  const dshHome = env["DSH_HOME"];
  if (dshHome !== void 0 && dshHome !== "") return join(dshHome, "graphrag");
  return join(homedir(), ".dsh", "graphrag");
}
function llmServiceOf(ctx) {
  try {
    const viaReflect = ctx.reflect?.get?.("llm", false);
    if (viaReflect != null) return viaReflect;
    return ctx.llm ?? null;
  } catch {
    return null;
  }
}
var LATEX_BACKOFF = 2;
function chunkText(chunk) {
  const c = chunk;
  return typeof c?.text === "string" ? c.text : void 0;
}
function chunkFailure(chunk) {
  const c = chunk;
  if (c?.failure === void 0 || c.failure === null) return void 0;
  const f = c.failure;
  return {
    code: typeof f.code === "string" ? f.code : void 0,
    message: typeof f.message === "string" ? f.message : void 0
  };
}
function mapLlmFailure(code, message) {
  if (code === "MISSING_CREDENTIAL" || code === "INVALID_CREDENTIAL") {
    return new GraphRagError("MISSING_CREDENTIAL", message ?? "\u5BBF\u4E3B\u6A21\u578B\u51ED\u636E\u7F3A\u5931");
  }
  if (code === "NO_ADAPTER") {
    return new GraphRagError("NO_PROVIDER", message ?? "\u5BBF\u4E3B\u672A\u914D\u7F6E\u6A21\u578B provider");
  }
  return new GraphRagError("NO_PROVIDER", message ?? `\u6A21\u578B\u8C03\u7528\u5931\u8D25\uFF08${code ?? "UNKNOWN"}\uFF09`);
}
function llmCompleterOf(ctx, route, policy = {}) {
  const maxRetries = policy.rateLimitRetries ?? 3;
  const baseDelay = policy.baseDelayMs ?? 500;
  const llmService = llmServiceOf(ctx);
  if (llmService === null || llmService === void 0) {
    throw new GraphRagError("NO_PROVIDER", "\u5BBF\u4E3B llm \u670D\u52A1\u4E0D\u53EF\u7528");
  }
  return {
    complete: async (system, user, signal) => {
      let lastRateLimitMessage = "";
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) throw new GraphRagError("ABORTED", "\u5DF2\u4E2D\u6B62");
        const stream = llmService.stream({
          provider: route.provider,
          model: route.model,
          maxTokens: route.maxTokens,
          messages: [
            { role: "system", content: [{ type: "text", text: system }] },
            { role: "user", content: [{ type: "text", text: user }] }
          ],
          signal
        });
        let out = "";
        let failure;
        for await (const chunk of stream) {
          const text = chunkText(chunk);
          if (text !== void 0) {
            out += text;
            continue;
          }
          const f = chunkFailure(chunk);
          if (f !== void 0) failure = f;
        }
        if (failure === void 0) return out;
        if (failure.code === "RATE_LIMIT" && attempt < maxRetries) {
          lastRateLimitMessage = failure.message ?? "";
          const delay = baseDelay * Math.pow(LATEX_BACKOFF, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw mapLlmFailure(failure.code, failure.message);
      }
      throw new GraphRagError("NO_PROVIDER", `RATE_LIMIT \u91CD\u8BD5\u8017\u5C3D\uFF1A${lastRateLimitMessage}`);
    }
  };
}

// src/core/ingest.ts
import { readFileSync as readFileSync2 } from "node:fs";

// src/core/chunker.ts
function estimateTokens(text) {
  let cjk = 0;
  let rest = 0;
  for (const ch of text) {
    if (/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/.test(ch)) cjk++;
    else if (!/\s/.test(ch)) rest++;
  }
  return Math.ceil(cjk + rest / 3.5);
}
function blocksOf(lines) {
  const blocks = [];
  let cur = null;
  const flush = () => {
    if (cur !== null && cur.lines.length > 0) blocks.push(cur);
    cur = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (cur !== null && /^#{1,6}\s/.test(line) && !/^#{1,6}\s/.test(cur.lines[0] ?? "")) {
      flush();
    }
    if (cur === null) cur = { start: i + 1, lines: [] };
    cur.lines.push(line);
  }
  flush();
  return blocks;
}
function chunkText2(path, text, opts = {}) {
  const target = opts.targetTokens ?? 1e3;
  const max = opts.maxTokens ?? 1400;
  const blocks = blocksOf(text.split("\n"));
  const results = [];
  const emit = (startLine, endLine, endCol, body) => {
    if (body === "") return;
    results.push({
      path,
      ordinal: results.length,
      startLine,
      endLine,
      startCol: 0,
      endCol,
      text: body,
      tokenEst: estimateTokens(body)
    });
  };
  let pending = [];
  let pendingStart = 1;
  let pendingEnd = 1;
  let pendingEndCol = 0;
  let pendingEst = 0;
  const flush = () => {
    if (pending.length > 0) {
      emit(pendingStart, pendingEnd, pendingEndCol, pending.join("\n\n"));
      pending = [];
      pendingEst = 0;
    }
  };
  for (const block of blocks) {
    const blockText = block.lines.join("\n");
    const blockEst = estimateTokens(blockText);
    const blockEnd = block.start + block.lines.length - 1;
    const blockEndCol = (block.lines[block.lines.length - 1] ?? "").length;
    if (blockEst > max) {
      flush();
      let acc = [];
      let accStart = block.start;
      let accEst = 0;
      for (let li = 0; li < block.lines.length; li++) {
        const line = block.lines[li];
        const lineEst = estimateTokens(line);
        if (accEst + lineEst > max && acc.length > 0) {
          emit(accStart, accStart + acc.length - 1, (acc[acc.length - 1] ?? "").length, acc.join("\n"));
          acc = [];
          accStart = block.start + li;
          accEst = 0;
        }
        acc.push(line);
        accEst += lineEst;
      }
      if (acc.length > 0) {
        emit(accStart, accStart + acc.length - 1, (acc[acc.length - 1] ?? "").length, acc.join("\n"));
      }
      continue;
    }
    if (pendingEst + blockEst > target && pending.length > 0) flush();
    if (pending.length === 0) pendingStart = block.start;
    pending.push(blockText);
    pendingEnd = blockEnd;
    pendingEndCol = blockEndCol;
    pendingEst += blockEst;
  }
  flush();
  return results;
}

// src/core/extractor.ts
import { z } from "zod";
var EXTRACTION_SYSTEM = `\u4F60\u662F\u4EE3\u7801\u5E93\u77E5\u8BC6\u62BD\u53D6\u5668\u3002\u4ECE\u7ED9\u5B9A\u6587\u672C\u5757\u4E2D\u62BD\u53D6\u5B9E\u4F53\u4E0E\u5173\u7CFB\u3002
\u5B9E\u4F53\u7C7B\u578B\uFF08\u5C01\u95ED\u96C6\uFF09\uFF1A${ENTITY_TYPES.join(", ")}
\u89C4\u5219\uFF1A
- \u53EA\u62BD\u53D6\u6587\u672C\u4E2D\u6709\u660E\u786E\u4F9D\u636E\u7684\u9879\uFF1B\u4E0D\u786E\u5B9A\u5C31\u4E0D\u62BD\uFF08\u5B81\u7F3A\u52FF\u6EE5\uFF09
- \u6BCF\u9879\u7ED9 confidence\uFF0C\u53D6\u503C 0.6 / 0.8 / 1.0
- \u5173\u7CFB\u7C7B\u578B\uFF08\u5C01\u95ED\u96C6\uFF09\uFF1A${RELATION_TYPES.join(", ")}
\u8F93\u51FA\uFF1A\u4EC5\u8F93\u51FA JSON\uFF0C\u65E0\u5176\u4ED6\u6587\u672C\u3002\u6A21\u5F0F\uFF1A
{"entities":[{"n":"\u540D\u79F0","t":"\u7C7B\u578B","d":"\u226440\u5B57\u63CF\u8FF0","c":0.8}],"relations":[{"s":"\u6E90\u540D","r":"\u7C7B\u578B","o":"\u76EE\u6807\u540D","d":"\u226440\u5B57\u63CF\u8FF0","c":0.8}]}`;
function buildExtractionUser(chunkText3, sourcePath) {
  return `\u6765\u6E90\uFF1A${sourcePath}

${chunkText3}`;
}
function stripFences(raw) {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return s.trim();
}
var RawEntity = z.object({
  n: z.string().min(1),
  t: z.string(),
  d: z.string().nullish(),
  c: z.number()
});
var RawRelation = z.object({
  s: z.string().min(1),
  r: z.string(),
  o: z.string().min(1),
  d: z.string().nullish(),
  c: z.number()
});
var RawOutput = z.object({
  entities: z.array(RawEntity).default([]),
  relations: z.array(RawRelation).default([])
});
function validateExtraction(rawObj, minConfidence) {
  const parsed = RawOutput.safeParse(rawObj);
  if (!parsed.success) return { items: { entities: [], relations: [] }, dropped: 0 };
  let dropped = 0;
  const entities = [];
  for (const e of parsed.data.entities) {
    if (!isEntityType(e.t) || !inConfidence(e.c) || e.c < minConfidence) {
      dropped++;
      continue;
    }
    entities.push({ n: e.n, t: e.t, d: e.d ?? null, c: e.c });
  }
  const relations = [];
  for (const r of parsed.data.relations) {
    if (!isRelationType(r.r) || !inConfidence(r.c) || r.c < minConfidence) {
      dropped++;
      continue;
    }
    relations.push({ s: r.s, r: r.r, o: r.o, d: r.d ?? null, c: r.c });
  }
  return { items: { entities, relations }, dropped };
}
function isEntityType(t) {
  return ENTITY_TYPES.includes(t);
}
function isRelationType(r) {
  return RELATION_TYPES.includes(r);
}
function inConfidence(c) {
  return Number.isFinite(c) && c > 0 && c <= 1;
}
function computeMentions(text, names) {
  const lower = text.toLowerCase();
  const out = [];
  for (const name2 of names) {
    if (name2.length === 0) continue;
    const needle = name2.toLowerCase();
    let from = 0;
    for (; ; ) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      out.push({ normName: normName(name2), spanStart: at, spanEnd: at + name2.length });
      from = at + name2.length;
    }
  }
  return out.sort((a, b) => a.spanStart - b.spanStart);
}
async function extractChunk(llm, chunkText3, sourcePath, opts = {}, signal) {
  const minConfidence = opts.minConfidence ?? 0.6;
  const retries = opts.repairRetries ?? 1;
  const system = EXTRACTION_SYSTEM;
  const user = buildExtractionUser(chunkText3, sourcePath);
  let raw;
  try {
    raw = await llm.complete(system, user, signal);
  } catch (err) {
    return { ok: false, errorCode: "LLM_ERROR", detail: err instanceof Error ? err.message : String(err), rawOutput: null, llmCalls: 0 };
  }
  let llmCalls = 1;
  let lastError = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) return { ok: false, errorCode: "LLM_ERROR", detail: "aborted", rawOutput: raw, llmCalls };
    const stripped = stripFences(raw);
    let obj;
    try {
      obj = JSON.parse(stripped);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        try {
          raw = await llm.complete(
            "\u4F60\u7684\u4E0A\u4E00\u4E2A\u8F93\u51FA\u4E0D\u662F\u5408\u6CD5 JSON\u3002\u4EC5\u8F93\u51FA\u4FEE\u6B63\u540E\u7684 JSON\uFF0C\u65E0\u5176\u4ED6\u6587\u672C\u3002",
            `\u4E0A\u6B21\u8F93\u51FA\uFF1A
${raw.slice(0, 4e3)}

\u9519\u8BEF\uFF1A${lastError}

\u8BF7\u8F93\u51FA\u4FEE\u6B63\u540E\u7684\u5B8C\u6574 JSON\u3002`,
            signal
          );
          llmCalls++;
          continue;
        } catch (err2) {
          return { ok: false, errorCode: "LLM_ERROR", detail: err2 instanceof Error ? err2.message : String(err2), rawOutput: raw, llmCalls };
        }
      }
      return { ok: false, errorCode: "PARSE_FAILED", detail: lastError, rawOutput: raw, llmCalls };
    }
    const { items, dropped } = validateExtraction(obj, minConfidence);
    if (items.entities.length === 0 && items.relations.length === 0) {
      if (dropped > 0) return { ok: false, errorCode: "PARSE_FAILED", detail: `${dropped} \u6761\u76EE\u672A\u901A\u8FC7\u6821\u9A8C\u88AB\u5168\u90E8\u4E22\u5F03`, rawOutput: raw, llmCalls };
      return { ok: false, errorCode: "EMPTY", detail: "\u65E0\u6709\u6548\u5B9E\u4F53\u6216\u5173\u7CFB", rawOutput: raw, llmCalls };
    }
    return { ok: true, items, dropped, llmCalls };
  }
  return { ok: false, errorCode: "PARSE_FAILED", detail: lastError, rawOutput: raw, llmCalls };
}

// src/core/lpa.ts
import { createHash } from "node:crypto";
function runLpa(nodes, edges, opts = {}) {
  const maxIter = opts.maxIterations ?? 30;
  const adjacency = /* @__PURE__ */ new Map();
  for (const e of edges) {
    for (const [a, b] of [[e.src, e.dst], [e.dst, e.src]]) {
      let list = adjacency.get(a);
      if (!list) {
        list = [];
        adjacency.set(a, list);
      }
      list.push({ dst: b, weight: e.weight });
    }
  }
  const label = /* @__PURE__ */ new Map();
  for (const n2 of nodes) label.set(n2, n2);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (const n2 of nodes) {
      const votes = /* @__PURE__ */ new Map();
      for (const { dst, weight } of adjacency.get(n2) ?? []) {
        const l = label.get(dst);
        if (l === void 0) continue;
        votes.set(l, (votes.get(l) ?? 0) + weight);
      }
      if (votes.size === 0) continue;
      let best = -1;
      let bestVotes = -1;
      for (const l of [...votes.keys()].sort((a, b) => a - b)) {
        const v = votes.get(l);
        if (v > bestVotes) {
          best = l;
          bestVotes = v;
        }
      }
      if (best >= 0 && best !== label.get(n2)) {
        label.set(n2, best);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const groups = /* @__PURE__ */ new Map();
  for (const n2 of nodes) {
    const l = label.get(n2);
    let g = groups.get(l);
    if (!g) {
      g = [];
      groups.set(l, g);
    }
    g.push(n2);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([label_, members]) => ({ label: label_, members: [...members].sort((a, b) => a - b), fingerprint: fingerprintOf(members) }));
}
function fingerprintOf(members) {
  return createHash("sha256").update([...members].sort((a, b) => a - b).join(",")).digest("hex").slice(0, 16);
}
function recomputeCommunities(store) {
  const entities = store.allEntities();
  const relations = store.allRelations();
  const nodes = entities.map((e) => e.id).sort((a, b) => a - b);
  const communities = runLpa(nodes, relations.map((r) => ({ src: r.srcId, dst: r.dstId, weight: r.weight })));
  const oldFingerprints = new Set(store.listCommunities().map((c) => c.fingerprint));
  let changed = 0;
  store.clearCommunities();
  for (const c of communities) {
    const id = store.putCommunity({ level: 0, label: c.label, fingerprint: c.fingerprint, memberCount: c.members.length });
    for (const m of c.members) store.assignCommunity(m, id);
    if (!oldFingerprints.has(c.fingerprint)) changed++;
  }
  return { communities: communities.length, changed };
}

// src/core/scanner.ts
import { createHash as createHash2 } from "node:crypto";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join as join2 } from "node:path";
function globToRegExp(pattern) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${esc}$`);
}
var DEFAULT_EXCLUDES = [
  ".git",
  "node_modules",
  ".DS_Store",
  ".env",
  ".env.*",
  "*.pem",
  "*secret*",
  "*credential*",
  "*credentials*"
];
function isExcluded(name2, patterns) {
  return patterns.some((re) => re.test(name2));
}
function scanRoots(roots, authorized, excludes = DEFAULT_EXCLUDES) {
  const authReal = authorized.map((a) => realpathSync(a));
  const patterns = [.../* @__PURE__ */ new Set([...DEFAULT_EXCLUDES, ...excludes])].map(globToRegExp);
  const files = [];
  const rejected = [];
  for (const root of roots) {
    let rootReal;
    try {
      rootReal = realpathSync(root);
    } catch {
      rejected.push({ root, reason: "\u8DEF\u5F84\u4E0D\u5B58\u5728" });
      continue;
    }
    if (!authReal.some((a) => rootReal === a || rootReal.startsWith(`${a}/`))) {
      rejected.push({ root, reason: "NOT_AUTHORIZED\uFF1A\u4E0D\u5728\u6388\u6743 roots \u5185" });
      continue;
    }
    walk(rootReal, rootReal, files, patterns);
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, rejected };
}
function walk(absDir, rootReal, out, patterns) {
  for (const name2 of readdirSync(absDir).sort()) {
    if (name2.startsWith(".") || isExcluded(name2, patterns)) continue;
    const abs = join2(absDir, name2);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walk(abs, rootReal, out, patterns);
      continue;
    }
    if (!st.isFile()) continue;
    const buf = readFileSync(abs);
    out.push({
      path: abs.slice(rootReal.length + 1),
      absPath: abs,
      sizeBytes: st.size,
      mtimeMs: Math.round(st.mtimeMs),
      contentHash: createHash2("sha256").update(buf).digest("hex")
    });
  }
}
function diffAgainstIndex(scanned, known) {
  const knownByPath = new Map(known.map((k) => [k.path, k]));
  const scannedPaths = new Set(scanned.map((f) => f.path));
  const added = [];
  const changed = [];
  for (const f of scanned) {
    const k = knownByPath.get(f.path);
    if (k === void 0) added.push(f);
    else if (k.contentHash !== f.contentHash) changed.push(f);
  }
  const removed = known.filter((k) => !scannedPaths.has(k.path) && k.state !== "deleted").map((k) => k.path);
  return { added, changed, removed };
}

// src/core/ingest.ts
function isBinary(buf) {
  return buf.includes(0);
}
function estTokens(s) {
  let cjk = 0;
  let rest = 0;
  for (const ch of s) {
    if (/[\u3400-\u9fff\u3040-\u30ff]/.test(ch)) cjk++;
    else if (!/\s/.test(ch)) rest++;
  }
  return Math.ceil(cjk + rest / 3.5);
}
async function runIngest(store, cfg, deps, signal, onProgress) {
  store.recoverInterruptedBatches();
  for (const s of store.listSources()) {
    if (s.state !== "merged" && s.state !== "deleted") store.setSourceState(s.id, "pending");
  }
  const roots = cfg.roots ?? cfg.authorizedRoots;
  const scan = scanRoots(roots, cfg.authorizedRoots, cfg.excludes);
  const diff = diffAgainstIndex(scan.files, store.listSources());
  const before = store.counts();
  const batchId = store.startBatch(diff.added.length + diff.changed.length);
  const cost = { llmCalls: 0, tokensIn: 0, tokensOut: 0 };
  let quarantined = 0;
  let skipped = 0;
  let aborted = false;
  for (const path of diff.removed) store.forget({ kind: "file", path });
  const scannedPaths = new Set(scan.files.map((f) => f.path));
  const dirtyPaths = new Set([...diff.added, ...diff.changed].map((f) => f.path));
  const resume = store.listSources().filter((s) => ["pending", "chunked", "extracting", "extracted", "failed"].includes(s.state) && scannedPaths.has(s.path) && !dirtyPaths.has(s.path)).map((s) => ({ path: s.path, absPath: s.absPath, contentHash: s.contentHash, sizeBytes: s.sizeBytes, mtimeMs: s.mtimeMs }));
  const dirty = [...diff.added, ...diff.changed, ...resume];
  onProgress?.({ phase: "scanning", filesDone: 0, filesTotal: dirty.length, quarantined: 0 });
  let done = 0;
  for (const f of dirty) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }
    onProgress?.({ phase: "extracting", filesDone: done, filesTotal: dirty.length, currentFile: f.path, quarantined });
    const buf = readFileSync2(f.absPath);
    if (isBinary(buf)) {
      skipped++;
      const src2 = store.upsertSource({ path: f.path, absPath: f.absPath, contentHash: f.contentHash, sizeBytes: f.sizeBytes, mtimeMs: f.mtimeMs });
      store.setSourceState(src2.id, "failed", "skipped-binary");
      done++;
      continue;
    }
    const text = buf.toString("utf8");
    const src = store.upsertSource({ path: f.path, absPath: f.absPath, contentHash: f.contentHash, sizeBytes: f.sizeBytes, mtimeMs: f.mtimeMs });
    const chunks = chunkText2(f.path, text, cfg.chunk);
    store.replaceChunks(src.id, chunks.map((c) => ({
      ordinal: c.ordinal,
      startLine: c.startLine,
      endLine: c.endLine,
      startCol: c.startCol,
      endCol: c.endCol,
      text: c.text,
      tokenEst: c.tokenEst
    })));
    store.setSourceState(src.id, "extracting");
    let fileFailed = false;
    let fileQuarantined = false;
    for (const chunkRow of store.getChunks(src.id)) {
      if (signal?.aborted) break;
      const res = await extractChunk(deps.llm, chunkRow.text, f.path, cfg.extract, signal);
      cost.llmCalls += res.llmCalls;
      cost.tokensIn += estTokens(chunkRow.text);
      cost.tokensOut += estTokens(res.ok ? "" : res.rawOutput ?? "");
      if (!res.ok && signal?.aborted) {
        aborted = true;
        break;
      }
      if (res.ok) {
        const names = res.items.entities.map((e) => e.n);
        const delta = {
          sourceId: src.id,
          chunkId: chunkRow.id,
          entities: res.items.entities.map((e) => ({ normName: normName(e.n), name: e.n, type: e.t, description: e.d, confidence: e.c })),
          relations: res.items.relations.map((r) => ({ srcNorm: normName(r.s), dstNorm: normName(r.o), type: r.r, description: r.d, confidence: r.c })),
          mentions: computeMentions(chunkRow.text, names)
        };
        store.applyExtraction(delta);
      } else if (res.errorCode === "EMPTY") {
      } else {
        quarantined++;
        fileQuarantined = fileQuarantined || res.errorCode === "PARSE_FAILED";
        fileFailed = fileFailed || res.errorCode === "LLM_ERROR";
        store.quarantinePut(chunkRow.id, chunkRow.text, res.rawOutput, res.errorCode, res.detail);
      }
    }
    if (signal?.aborted) {
      aborted = true;
      store.setSourceState(src.id, "pending");
      break;
    }
    if (fileFailed) store.setSourceState(src.id, "failed", "LLM_ERROR");
    else if (fileQuarantined) store.setSourceState(src.id, "quarantined");
    else store.setSourceState(src.id, "merged");
    done++;
  }
  const afterFiles = store.counts();
  let communitiesRebuilt = 0;
  let summariesRecomputed = 0;
  const threshold = cfg.community?.recomputeThreshold ?? 0.05;
  const edgeDelta = afterFiles.relations - before.relations + diff.removed.length;
  if (!aborted && afterFiles.relations > 0 && edgeDelta / Math.max(afterFiles.relations, 1) >= threshold) {
    onProgress?.({ phase: "communities", filesDone: dirty.length, filesTotal: dirty.length, quarantined });
    const res = recomputeCommunities(store);
    communitiesRebuilt = res.communities;
    onProgress?.({ phase: "summarizing", filesDone: dirty.length, filesTotal: dirty.length, quarantined });
    for (const c of store.listCommunities()) {
      const summary = store.allSummaries().find((s) => s.communityId === c.id);
      if (summary && summary.fingerprintAt === c.fingerprint) continue;
      const members = store.entitiesByCommunity(c.id, 8);
      const topEdges = store.relationsAmong(new Set(members.map((m) => m.id)), 8).map((e) => ({ s: e.srcName, r: e.relation.type, o: e.dstName }));
      const text = await deps.summarize({ members: members.map((m) => ({ name: m.name, type: m.type, description: m.description })), topEdges });
      cost.tokensIn += estTokens(JSON.stringify(members));
      cost.tokensOut += estTokens(text);
      cost.llmCalls += 1;
      store.putSummary({ communityId: c.id, summary: text, entitiesTop: members.slice(0, 5).map((m) => m.name), fingerprintAt: c.fingerprint });
      summariesRecomputed++;
    }
  }
  store.finishBatch(batchId, aborted ? "aborted" : "done", cost);
  const final = store.counts();
  return {
    files: { new: diff.added.length, changed: diff.changed.length, deleted: diff.removed.length, skipped },
    graphDelta: {
      entitiesAdded: final.entities - before.entities,
      relationsAdded: final.relations - before.relations,
      communitiesRebuilt,
      summariesRecomputed
    },
    cost,
    quarantined,
    aborted
  };
}

// src/core/kb.ts
import { existsSync, mkdirSync, readdirSync as readdirSync2, readFileSync as readFileSync3, renameSync, rmSync, statSync as statSync2, writeFileSync } from "node:fs";
import { join as join3 } from "node:path";
function slugify(name2) {
  const base = name2.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base === "" ? "kb" : base.slice(0, 40);
}
var KbRegistry = class _KbRegistry {
  kbs;
  file;
  constructor(file, kbs) {
    this.file = file;
    this.kbs = kbs;
  }
  static load(dataDir) {
    const file = join3(dataDir, "kbs.json");
    if (!existsSync(file)) return new _KbRegistry(file, []);
    const raw = JSON.parse(readFileSync3(file, "utf8"));
    if (raw.version !== 1) throw new GraphRagError("SCHEMA_FUTURE", `kbs.json \u7248\u672C ${String(raw.version)} \u9AD8\u4E8E\u5B9E\u73B0`);
    return new _KbRegistry(file, raw.kbs ?? []);
  }
  save() {
    mkdirSync(join3(this.file, ".."), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ version: 1, kbs: this.kbs }, null, 2));
  }
  list() {
    return this.kbs;
  }
  byId(id) {
    return this.kbs.find((k) => k.id === id);
  }
  byName(name2) {
    const key = normName(name2);
    return this.kbs.find((k) => normName(k.name) === key);
  }
  /** cwd（realpath 后）落在唯一 KB 的某 root 内 → 该 KB；零/多命中 → undefined。 */
  byCwd(cwdReal) {
    const hits = this.kbs.filter((k) => k.roots.some((r) => cwdReal === r || cwdReal.startsWith(`${r}/`)));
    return hits.length === 1 ? hits[0] : void 0;
  }
  create(input, managed = "user") {
    if (input.name.trim() === "") throw new GraphRagError("INVALID", "\u77E5\u8BC6\u5E93\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A");
    if (this.byName(input.name) !== void 0) {
      throw new GraphRagError("INVALID", `\u77E5\u8BC6\u5E93\u540D\u79F0\u5DF2\u5B58\u5728\uFF1A${input.name}`);
    }
    let id = slugify(input.name);
    while (this.byId(id) !== void 0) id = `${id}-${this.kbs.length + 1}`;
    const kb = {
      id,
      name: input.name.trim(),
      roots: [...input.roots],
      description: input.description ?? null,
      managed,
      createdAt: Date.now(),
      lastIndexedAt: null
    };
    this.kbs.push(kb);
    this.save();
    return kb;
  }
  update(id, patch) {
    const kb = this.byId(id);
    if (kb === void 0) throw new GraphRagError("INVALID", `\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728\uFF1A${id}`);
    if (kb.managed === "config") throw new GraphRagError("INVALID", "\u914D\u7F6E\u6258\u7BA1\u7684\u77E5\u8BC6\u5E93\u8BF7\u4FEE\u6539 cordis.patch.yml \u914D\u7F6E");
    if (patch.name !== void 0 && normName(patch.name) !== normName(kb.name)) {
      const other = this.byName(patch.name);
      if (other !== void 0 && other.id !== id) throw new GraphRagError("INVALID", `\u77E5\u8BC6\u5E93\u540D\u79F0\u5DF2\u5B58\u5728\uFF1A${patch.name}`);
    }
    const next = {
      ...kb,
      name: patch.name?.trim() || kb.name,
      roots: patch.roots ? [...patch.roots] : kb.roots,
      description: patch.description === void 0 ? kb.description : patch.description
    };
    this.kbs = this.kbs.map((k) => k.id === id ? next : k);
    this.save();
    return next;
  }
  remove(id) {
    const kb = this.byId(id);
    if (kb === void 0) throw new GraphRagError("INVALID", `\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728\uFF1A${id}`);
    this.kbs = this.kbs.filter((k) => k.id !== id);
    this.save();
  }
  touchIndexed(id, at) {
    this.kbs = this.kbs.map((k) => k.id === id ? { ...k, lastIndexedAt: at } : k);
    this.save();
  }
};
function migrateLegacyWorkspaces(dataDir, registry, defaultRoots) {
  const legacyDir = join3(dataDir, "workspaces");
  if (!existsSync(legacyDir) || registry.list().length > 0) return [];
  const migrated = [];
  for (const hash of readdirSync2(legacyDir).filter((n2) => statSync2(join3(legacyDir, n2)).isDirectory()).sort()) {
    const id = `legacy-${hash.slice(0, 6)}`;
    if (registry.byId(id) !== void 0) continue;
    const target = join3(dataDir, "kbs", id);
    mkdirSync(join3(dataDir, "kbs"), { recursive: true });
    renameSync(join3(legacyDir, hash), target);
    migrated.push(registry.create({
      name: `legacy-${hash.slice(0, 6)}`,
      roots: defaultRoots,
      description: "\u7531\u5355\u5DE5\u4F5C\u533A\u65E7\u5E03\u5C40\u8FC1\u79FB\uFF1B\u5982 roots \u4E0D\u7B26\u8BF7\u5728\u9762\u677F/\u914D\u7F6E\u4E2D\u4FEE\u6B63"
    }, "user"));
  }
  const leftovers = readdirSync2(legacyDir).filter((n2) => n2 !== ".DS_Store");
  if (leftovers.length === 0) rmSync(legacyDir, { recursive: true, force: true });
  return migrated;
}

// src/core/graphstore.ts
import { DatabaseSync } from "node:sqlite";
var SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS source (
  id           INTEGER PRIMARY KEY,
  path         TEXT NOT NULL UNIQUE,
  abs_path     TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  mtime_ms     INTEGER NOT NULL,
  state        TEXT NOT NULL DEFAULT 'pending',
  error        TEXT
);

CREATE TABLE IF NOT EXISTS chunk (
  id         INTEGER PRIMARY KEY,
  source_id  INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  ordinal    INTEGER NOT NULL,
  start_line INTEGER NOT NULL,
  end_line   INTEGER NOT NULL,
  start_col  INTEGER NOT NULL,
  end_col    INTEGER NOT NULL,
  text       TEXT NOT NULL,
  token_est  INTEGER NOT NULL,
  UNIQUE(source_id, ordinal)
);

CREATE TABLE IF NOT EXISTS entity (
  id           INTEGER PRIMARY KEY,
  norm_name    TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  description  TEXT,
  community_id INTEGER REFERENCES community(id) ON DELETE SET NULL,
  degree       INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS entity_alias (
  entity_id INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  alias     TEXT NOT NULL,
  PRIMARY KEY (entity_id, alias)
);

CREATE TABLE IF NOT EXISTS relation (
  id          INTEGER PRIMARY KEY,
  src_id      INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  dst_id      INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  weight      INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  confidence  REAL NOT NULL DEFAULT 0.5,
  UNIQUE(src_id, dst_id, type)
);
CREATE INDEX IF NOT EXISTS idx_relation_src ON relation(src_id);
CREATE INDEX IF NOT EXISTS idx_relation_dst ON relation(dst_id);

CREATE TABLE IF NOT EXISTS mention (
  id         INTEGER PRIMARY KEY,
  chunk_id   INTEGER NOT NULL REFERENCES chunk(id) ON DELETE CASCADE,
  entity_id  INTEGER NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  span_start INTEGER NOT NULL,
  span_end   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mention_entity ON mention(entity_id);
CREATE INDEX IF NOT EXISTS idx_mention_chunk ON mention(chunk_id);

CREATE TABLE IF NOT EXISTS community (
  id           INTEGER PRIMARY KEY,
  level        INTEGER NOT NULL DEFAULT 0,
  label        INTEGER NOT NULL,
  fingerprint  TEXT NOT NULL,
  member_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS community_summary (
  community_id  INTEGER PRIMARY KEY REFERENCES community(id) ON DELETE CASCADE,
  summary       TEXT NOT NULL,
  entities_top  TEXT NOT NULL,
  generated_at  INTEGER NOT NULL,
  fingerprint_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extraction_batch (
  id          INTEGER PRIMARY KEY,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  status      TEXT NOT NULL DEFAULT 'running',
  llm_calls   INTEGER NOT NULL DEFAULT 0,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  files_total INTEGER NOT NULL DEFAULT 0,
  files_done  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quarantine (
  id           INTEGER PRIMARY KEY,
  chunk_id     INTEGER REFERENCES chunk(id) ON DELETE SET NULL,
  raw_input    TEXT NOT NULL,
  raw_output   TEXT,
  error_code   TEXT NOT NULL,
  error_detail TEXT,
  created_at   INTEGER NOT NULL,
  resolved     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS relation_evidence (
  relation_id INTEGER NOT NULL REFERENCES relation(id) ON DELETE CASCADE,
  chunk_id    INTEGER NOT NULL REFERENCES chunk(id) ON DELETE CASCADE,
  PRIMARY KEY (relation_id, chunk_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(text, path UNINDEXED, tokenize='trigram');
CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(name, tokenize='trigram');
`;
var n = (v) => v === null || v === void 0 ? null : Number(v);
var SqliteGraphStore = class {
  db;
  closed = false;
  constructor(location) {
    this.db = new DatabaseSync(location);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.migrate();
  }
  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
  // ── 迁移 ───────────────────────────────────────────────────────────────────
  migrate() {
    this.db.exec(SCHEMA_V1);
    this.db.exec("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')");
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get("schema_version");
    const version = Number(row.value);
    if (version > 1) {
      throw new Error(`SCHEMA_FUTURE: \u5E93\u7248\u672C ${version} \u9AD8\u4E8E\u672C\u5B9E\u73B0\uFF081\uFF09\uFF0C\u62D2\u7EDD\u6253\u5F00`);
    }
  }
  meta(key) {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
    return row?.value ?? null;
  }
  setMeta(key, value) {
    this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }
  // ── source / chunk 生命周期 ───────────────────────────────────────────────
  upsertSource(s) {
    const existing = this.db.prepare("SELECT * FROM source WHERE path = ?").get(s.path);
    if (existing) {
      this.db.prepare("UPDATE source SET abs_path=?, content_hash=?, size_bytes=?, mtime_ms=?, state=?, error=NULL WHERE id=?").run(s.absPath, s.contentHash, BigInt(s.sizeBytes), BigInt(s.mtimeMs), "pending", existing.id);
      return this.getSource(s.path);
    }
    const res = this.db.prepare(
      "INSERT INTO source (path, abs_path, content_hash, size_bytes, mtime_ms, state) VALUES (?, ?, ?, ?, ?, 'pending')"
    ).run(s.path, s.absPath, s.contentHash, BigInt(s.sizeBytes), BigInt(s.mtimeMs));
    return { ...s, id: Number(res.lastInsertRowid), state: "pending", error: null };
  }
  getSource(path) {
    const r = this.db.prepare("SELECT * FROM source WHERE path = ?").get(path);
    return r ? this.mapSource(r) : null;
  }
  listSources() {
    return this.db.prepare("SELECT * FROM source ORDER BY path").all().map((r) => this.mapSource(r));
  }
  mapSource(r) {
    return {
      id: Number(r.id),
      path: r.path,
      absPath: r.abs_path,
      contentHash: r.content_hash,
      sizeBytes: Number(r.size_bytes),
      mtimeMs: Number(r.mtime_ms),
      state: r.state,
      error: r.error
    };
  }
  setSourceState(id, state, error = null) {
    this.db.prepare("UPDATE source SET state=?, error=? WHERE id=?").run(state, error, BigInt(id));
  }
  replaceChunks(sourceId, chunks) {
    this.tx(() => {
      this.db.prepare("DELETE FROM chunk_fts WHERE rowid IN (SELECT id FROM chunk WHERE source_id = ?)").run(BigInt(sourceId));
      this.db.prepare("DELETE FROM chunk WHERE source_id = ?").run(BigInt(sourceId));
      const ins = this.db.prepare(
        "INSERT INTO chunk (source_id, ordinal, start_line, end_line, start_col, end_col, text, token_est) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      const ftsIns = this.db.prepare("INSERT INTO chunk_fts (rowid, text, path) VALUES (?, ?, ?)");
      const path = this.db.prepare("SELECT path FROM source WHERE id = ?").get(BigInt(sourceId)).path;
      for (const c of chunks) {
        const res = ins.run(
          BigInt(sourceId),
          BigInt(c.ordinal),
          BigInt(c.startLine),
          BigInt(c.endLine),
          BigInt(c.startCol),
          BigInt(c.endCol),
          c.text,
          BigInt(c.tokenEst)
        );
        ftsIns.run(res.lastInsertRowid, c.text, path);
      }
    });
  }
  getChunks(sourceId) {
    const rows = this.db.prepare("SELECT c.*, s.path FROM chunk c JOIN source s ON s.id = c.source_id WHERE c.source_id = ? ORDER BY c.ordinal").all(BigInt(sourceId));
    return rows.map((r) => ({
      id: Number(r.id),
      sourceId: Number(r.source_id),
      sourcePath: r.path,
      ordinal: Number(r.ordinal),
      startLine: Number(r.start_line),
      endLine: Number(r.end_line),
      startCol: Number(r.start_col),
      endCol: Number(r.end_col),
      text: r.text
    }));
  }
  searchChunks(terms, k) {
    if (terms.length === 0) return [];
    const match = terms.map((t) => `"${t.replaceAll('"', '""')}"`).join(" OR ");
    const hits = this.db.prepare(
      `SELECT f.rowid AS cid, bm25(chunk_fts) AS score FROM chunk_fts f WHERE chunk_fts MATCH ? ORDER BY score LIMIT ?`
    ).all(match, BigInt(k));
    return hits.map((h) => {
      const chunk = this.getChunkById(Number(h.cid));
      return chunk ? { chunk, score: h.score } : null;
    }).filter((x) => x !== null);
  }
  getChunkById(id) {
    const r = this.db.prepare("SELECT c.*, s.path FROM chunk c JOIN source s ON s.id = c.source_id WHERE c.id = ?").get(BigInt(id));
    if (!r) return null;
    return {
      id: Number(r.id),
      sourceId: Number(r.source_id),
      sourcePath: r.path,
      ordinal: Number(r.ordinal),
      startLine: Number(r.start_line),
      endLine: Number(r.end_line),
      startCol: Number(r.start_col),
      endCol: Number(r.end_col),
      text: r.text
    };
  }
  // ── 图写入：applyExtraction（单事务）──────────────────────────────────────
  /** 实体 upsert + 关系聚合 + mention + 证据关联，一个事务。
   * 崩溃/异常整体回滚（0202 §4 事务边界约定）。 */
  applyExtraction(delta) {
    this.tx(() => {
      const idByNorm = /* @__PURE__ */ new Map();
      for (const e of delta.entities) {
        const id = this.upsertEntityTx(e);
        idByNorm.set(e.normName, id);
      }
      for (const rel of delta.relations) {
        const src = idByNorm.get(rel.srcNorm) ?? this.getEntityId(rel.srcNorm);
        const dst = idByNorm.get(rel.dstNorm) ?? this.getEntityId(rel.dstNorm);
        if (src === void 0 || dst === void 0) continue;
        this.upsertRelationTx(src, dst, rel, delta.chunkId);
        this.bumpDegreeTx(src, 1);
        this.bumpDegreeTx(dst, 1);
      }
      for (const m of delta.mentions) {
        const id = idByNorm.get(m.normName) ?? this.getEntityId(m.normName);
        if (id === void 0) continue;
        this.db.prepare("INSERT INTO mention (chunk_id, entity_id, span_start, span_end) VALUES (?, ?, ?, ?)").run(BigInt(delta.chunkId), BigInt(id), BigInt(m.spanStart), BigInt(m.spanEnd));
      }
      this.setSourceState(delta.sourceId, "extracted");
    });
  }
  upsertEntityTx(e) {
    const existing = this.db.prepare("SELECT id FROM entity WHERE norm_name = ?").get(e.normName);
    if (existing) {
      const id2 = Number(existing.id);
      if (e.description !== null) {
        this.db.prepare("UPDATE entity SET description = COALESCE(description, ?) WHERE id = ?").run(e.description, BigInt(id2));
      }
      if (e.name !== e.normName) {
        this.db.prepare("INSERT OR IGNORE INTO entity_alias (entity_id, alias) VALUES (?, ?)").run(BigInt(id2), e.name);
      }
      return id2;
    }
    const res = this.db.prepare("INSERT INTO entity (norm_name, name, type, description) VALUES (?, ?, ?, ?)").run(e.normName, e.name, e.type, e.description);
    const id = Number(res.lastInsertRowid);
    this.db.prepare("INSERT INTO entity_fts (rowid, name) VALUES (?, ?)").run(res.lastInsertRowid, e.name);
    if (e.name !== e.normName) {
      this.db.prepare("INSERT OR IGNORE INTO entity_alias (entity_id, alias) VALUES (?, ?)").run(BigInt(id), e.name);
    }
    return id;
  }
  getEntityId(normName2) {
    const r = this.db.prepare("SELECT id FROM entity WHERE norm_name = ?").get(normName2);
    return r === void 0 ? void 0 : Number(r.id);
  }
  upsertRelationTx(src, dst, rel, chunkId) {
    const existing = this.db.prepare("SELECT id, weight, confidence FROM relation WHERE src_id=? AND dst_id=? AND type=?").get(BigInt(src), BigInt(dst), rel.type);
    let relId;
    if (existing) {
      relId = Number(existing.id);
      const w = Number(existing.weight);
      const c = Number(existing.confidence);
      const newConf = (c * w + rel.confidence) / (w + 1);
      this.db.prepare("UPDATE relation SET weight = weight + 1, confidence = ?, description = COALESCE(description, ?) WHERE id = ?").run(newConf, rel.description, BigInt(relId));
    } else {
      const res = this.db.prepare("INSERT INTO relation (src_id, dst_id, type, weight, description, confidence) VALUES (?, ?, ?, 1, ?, ?)").run(BigInt(src), BigInt(dst), rel.type, rel.description, rel.confidence);
      relId = Number(res.lastInsertRowid);
    }
    this.db.prepare("INSERT OR IGNORE INTO relation_evidence (relation_id, chunk_id) VALUES (?, ?)").run(BigInt(relId), BigInt(chunkId));
  }
  bumpDegreeTx(id, delta) {
    this.db.prepare("UPDATE entity SET degree = degree + ? WHERE id = ?").run(BigInt(delta), BigInt(id));
  }
  // ── 图读取 ─────────────────────────────────────────────────────────────────
  mapEntity(r) {
    return {
      id: Number(r.id),
      normName: r.norm_name,
      name: r.name,
      type: r.type,
      description: r.description,
      communityId: n(r.community_id),
      degree: Number(r.degree)
    };
  }
  mapRelation(r) {
    return {
      id: Number(r.id),
      srcId: Number(r.src_id),
      dstId: Number(r.dst_id),
      type: r.type,
      weight: Number(r.weight),
      description: r.description,
      confidence: Number(r.confidence)
    };
  }
  getEntity(normName2) {
    const r = this.db.prepare("SELECT * FROM entity WHERE norm_name = ?").get(normName2);
    return r ? this.mapEntity(r) : null;
  }
  findEntitiesByLexical(terms, limit) {
    if (terms.length === 0) return [];
    const match = terms.map((t) => `"${t.replaceAll('"', '""')}"`).join(" OR ");
    const rows = this.db.prepare(
      `SELECT e.*, bm25(entity_fts) AS score FROM entity_fts f JOIN entity e ON e.id = f.rowid
       WHERE entity_fts MATCH ? ORDER BY score LIMIT ?`
    ).all(match, BigInt(limit));
    return rows.map((r) => ({ entity: this.mapEntity(r), score: r.score }));
  }
  neighbors(id, dir, types) {
    const conds = [];
    const params = [];
    if (dir === "out") conds.push("r.src_id = ?");
    else if (dir === "in") conds.push("r.dst_id = ?");
    else conds.push("(r.src_id = ? OR r.dst_id = ?)");
    params.push(BigInt(id));
    if (dir === "both") params.push(BigInt(id));
    if (types && types.length > 0) {
      conds.push(`r.type IN (${types.map(() => "?").join(",")})`);
      params.push(...types);
    }
    const rows = this.db.prepare(
      `SELECT r.*, se.name AS src_name, de.name AS dst_name FROM relation r
       JOIN entity se ON se.id = r.src_id JOIN entity de ON de.id = r.dst_id
       WHERE ${conds.join(" AND ")} ORDER BY r.weight DESC`
    ).all(...params);
    return rows.map((r) => ({ relation: this.mapRelation(r), srcName: r.src_name, dstName: r.dst_name }));
  }
  /** BFS 遍历：节点预算硬上限 + 截断标记（0203 §2.3）。 */
  bfs(startIds, hops, dir, types, budget) {
    const visited = new Set(startIds);
    let frontier = [...startIds];
    const edges = [];
    let truncated = false;
    for (let h = 0; h < hops; h++) {
      const next = [];
      for (const node of frontier) {
        for (const edge of this.neighbors(node, dir, types)) {
          const other = edge.relation.srcId === node ? edge.relation.dstId : edge.relation.srcId;
          edges.push(edge);
          if (!visited.has(other)) {
            if (visited.size >= budget) {
              truncated = true;
              continue;
            }
            visited.add(other);
            next.push(other);
          }
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }
    const nodes = [...visited].map((id) => this.getEntityById(id)).filter((e) => e !== null);
    return { nodes, edges: dedupeEdges(edges), truncated };
  }
  getEntityById(id) {
    const r = this.db.prepare("SELECT * FROM entity WHERE id = ?").get(BigInt(id));
    return r ? this.mapEntity(r) : null;
  }
  chunksForEntities(ids, limitPerEntity) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const id of ids) {
      const rows = this.db.prepare(
        `SELECT c.* FROM mention m JOIN chunk c ON c.id = m.chunk_id WHERE m.entity_id = ? LIMIT ?`
      ).all(BigInt(id), BigInt(limitPerEntity));
      for (const r of rows) {
        const cid = Number(r.id);
        if (seen.has(cid)) continue;
        seen.add(cid);
        const chunk = this.getChunkById(cid);
        if (chunk) out.push(chunk);
      }
    }
    return out;
  }
  allEntities() {
    return this.db.prepare("SELECT * FROM entity").all().map((r) => this.mapEntity(r));
  }
  entitiesByCommunity(communityId, limit = 50) {
    return this.db.prepare("SELECT * FROM entity WHERE community_id = ? ORDER BY degree DESC LIMIT ?").all(BigInt(communityId), BigInt(limit)).map((r) => this.mapEntity(r));
  }
  communityOf(communityId) {
    const r = this.db.prepare("SELECT * FROM community WHERE id = ?").get(BigInt(communityId));
    if (!r) return null;
    return {
      id: Number(r.id),
      level: Number(r.level),
      label: Number(r.label),
      fingerprint: r.fingerprint,
      memberCount: Number(r.member_count)
    };
  }
  /** 给定实体集内部的边（local 证据组装用）。 */
  relationsAmong(entityIds, limit = 40) {
    if (entityIds.size === 0) return [];
    const ph = [...entityIds].map(() => "?").join(",");
    const params = [...entityIds].map(BigInt);
    const rows = this.db.prepare(
      `SELECT r.*, se.name AS src_name, de.name AS dst_name FROM relation r
       JOIN entity se ON se.id = r.src_id JOIN entity de ON de.id = r.dst_id
       WHERE r.src_id IN (${ph}) AND r.dst_id IN (${ph}) ORDER BY r.weight DESC LIMIT ?`
    ).all(...params, ...params, BigInt(limit));
    return rows.map((r) => ({ relation: this.mapRelation(r), srcName: r.src_name, dstName: r.dst_name }));
  }
  /** chunk 内被提及的实体 id（chunk FTS 反查种子的桥，0203 §2.1）。 */
  entitiesInChunk(chunkId) {
    const rows = this.db.prepare("SELECT entity_id FROM mention WHERE chunk_id = ?").all(BigInt(chunkId));
    return rows.map((r) => Number(r.entity_id));
  }
  /** 实体某条关系的一条原文证据（mention chunk 引用）。 */
  evidenceChunkFor(entityId) {
    const chunk = this.chunksForEntities([entityId], 1);
    return chunk[0] ?? null;
  }
  allRelations() {
    return this.db.prepare("SELECT * FROM relation").all().map((r) => this.mapRelation(r));
  }
  // ── 社区（读/写；重算随 lpa.ts 于 W4 提供）───────────────────────────────
  putCommunity(c) {
    const res = this.db.prepare("INSERT INTO community (level, label, fingerprint, member_count) VALUES (?, ?, ?, ?)").run(BigInt(c.level), BigInt(c.label), c.fingerprint, BigInt(c.memberCount));
    return Number(res.lastInsertRowid);
  }
  clearCommunities() {
    this.tx(() => {
      this.db.prepare("DELETE FROM community_summary").run();
      this.db.prepare("UPDATE entity SET community_id = NULL").run();
      this.db.prepare("DELETE FROM community").run();
    });
  }
  assignCommunity(entityId, communityId) {
    this.db.prepare("UPDATE entity SET community_id = ? WHERE id = ?").run(BigInt(communityId), BigInt(entityId));
  }
  listCommunities() {
    const rows = this.db.prepare("SELECT * FROM community ORDER BY id").all();
    return rows.map((r) => ({
      id: Number(r.id),
      level: Number(r.level),
      label: Number(r.label),
      fingerprint: r.fingerprint,
      memberCount: Number(r.member_count)
    }));
  }
  putSummary(s) {
    this.db.prepare(
      `INSERT INTO community_summary (community_id, summary, entities_top, generated_at, fingerprint_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(community_id) DO UPDATE SET summary=excluded.summary, entities_top=excluded.entities_top,
         generated_at=excluded.generated_at, fingerprint_at=excluded.fingerprint_at`
    ).run(BigInt(s.communityId), s.summary, JSON.stringify(s.entitiesTop), BigInt(Date.now()), s.fingerprintAt);
  }
  allSummaries() {
    const rows = this.db.prepare("SELECT * FROM community_summary").all();
    return rows.map((r) => ({
      communityId: Number(r.community_id),
      summary: r.summary,
      entitiesTop: JSON.parse(r.entities_top),
      generatedAt: Number(r.generated_at),
      fingerprintAt: r.fingerprint_at
    }));
  }
  // ── 隔离区 ─────────────────────────────────────────────────────────────────
  quarantinePut(chunkId, rawInput, rawOutput, errorCode, errorDetail) {
    this.db.prepare(
      "INSERT INTO quarantine (chunk_id, raw_input, raw_output, error_code, error_detail, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?, 0)"
    ).run(chunkId === null ? null : BigInt(chunkId), rawInput, rawOutput, errorCode, errorDetail, BigInt(Date.now()));
  }
  quarantineList(includeResolved = false) {
    const rows = (includeResolved ? this.db.prepare("SELECT * FROM quarantine ORDER BY id") : this.db.prepare("SELECT * FROM quarantine WHERE resolved = 0 ORDER BY id")).all();
    return rows.map((r) => ({
      id: Number(r.id),
      chunkId: n(r.chunk_id),
      rawInput: r.raw_input,
      rawOutput: r.raw_output,
      errorCode: r.error_code,
      errorDetail: r.error_detail,
      createdAt: Number(r.created_at),
      resolved: Number(r.resolved) === 1
    }));
  }
  quarantineResolve(id) {
    this.db.prepare("UPDATE quarantine SET resolved = 1 WHERE id = ?").run(BigInt(id));
  }
  // ── checkpoint（extraction_batch）─────────────────────────────────────────
  startBatch(filesTotal) {
    const res = this.db.prepare("INSERT INTO extraction_batch (started_at, status, files_total) VALUES (?, 'running', ?)").run(BigInt(Date.now()), BigInt(filesTotal));
    return Number(res.lastInsertRowid);
  }
  finishBatch(id, status, cost) {
    this.db.prepare("UPDATE extraction_batch SET finished_at=?, status=?, llm_calls=?, tokens_in=?, tokens_out=? WHERE id=?").run(BigInt(Date.now()), status, BigInt(cost.llmCalls), BigInt(cost.tokensIn), BigInt(cost.tokensOut), BigInt(id));
  }
  /** 恢复扫描：残留 running 批次标记 aborted（0203 §1.1）。 */
  recoverInterruptedBatches() {
    const res = this.db.prepare("UPDATE extraction_batch SET status='aborted', finished_at=? WHERE status='running'").run(BigInt(Date.now()));
    return Number(res.changes);
  }
  listBatches() {
    const rows = this.db.prepare("SELECT id, status, llm_calls FROM extraction_batch ORDER BY id").all();
    return rows.map((r) => ({ id: Number(r.id), status: r.status, llmCalls: Number(r.llm_calls) }));
  }
  // ── 治理：forget ──────────────────────────────────────────────────────────
  forget(target) {
    return this.tx(() => {
      if (target.kind === "graph") {
        const before = this.counts();
        this.db.exec(`DELETE FROM mention; DELETE FROM relation_evidence; DELETE FROM relation; DELETE FROM entity_alias;
          DELETE FROM entity; DELETE FROM community_summary; DELETE FROM community; DELETE FROM quarantine;
          DELETE FROM chunk_fts; DELETE FROM entity_fts;
          DELETE FROM chunk; DELETE FROM source;`);
        return {
          deleted: {
            chunks: before.chunks,
            mentions: before.mentions,
            relations: before.relations,
            entities: before.entities,
            summaries: before.summaries
          },
          communitiesRebuilt: before.communities
        };
      }
      if (target.kind === "file") {
        const src = this.getSource(target.path);
        if (!src) return { deleted: { chunks: 0, mentions: 0, relations: 0, entities: 0, summaries: 0 }, communitiesRebuilt: 0 };
        const chunkIds = this.db.prepare("SELECT id FROM chunk WHERE source_id = ?").all(BigInt(src.id)).map((r) => Number(r.id));
        const mentions2 = Number(this.db.prepare("SELECT COUNT(*) AS c FROM mention WHERE chunk_id IN (SELECT id FROM chunk WHERE source_id = ?)").get(BigInt(src.id)).c);
        this.db.prepare("DELETE FROM chunk_fts WHERE rowid IN (SELECT id FROM chunk WHERE source_id = ?)").run(BigInt(src.id));
        this.db.prepare("DELETE FROM relation_evidence WHERE chunk_id IN (SELECT id FROM chunk WHERE source_id = ?)").run(BigInt(src.id));
        this.db.prepare("DELETE FROM relation WHERE id NOT IN (SELECT DISTINCT relation_id FROM relation_evidence)").run();
        this.db.prepare("DELETE FROM source WHERE id = ?").run(BigInt(src.id));
        const entities = this.cleanupOrphanEntities();
        void chunkIds;
        return { deleted: { chunks: chunkIds.length, mentions: mentions2, relations: 0, entities, summaries: 0 }, communitiesRebuilt: 0 };
      }
      const ent = this.getEntity(normOf(target.name));
      if (!ent) return { deleted: { chunks: 0, mentions: 0, relations: 0, entities: 0, summaries: 0 }, communitiesRebuilt: 0 };
      const relations = Number(this.db.prepare("SELECT COUNT(*) AS c FROM relation WHERE src_id=? OR dst_id=?").get(BigInt(ent.id), BigInt(ent.id)).c);
      const mentions = Number(this.db.prepare("SELECT COUNT(*) AS c FROM mention WHERE entity_id = ?").get(BigInt(ent.id)).c);
      this.db.prepare("DELETE FROM entity_fts WHERE rowid = ?").run(BigInt(ent.id));
      this.db.prepare("DELETE FROM entity WHERE id = ?").run(BigInt(ent.id));
      return { deleted: { chunks: 0, mentions, relations, entities: 1, summaries: 0 }, communitiesRebuilt: 0 };
    });
  }
  /** 孤儿清理：无 mention 且度为 0 的实体（0203 §1.6）。返回删除数。
   * 先重算度数再删（关系可能已被证据清扫移除）；entity_fts 同步清理。 */
  cleanupOrphanEntities() {
    this.db.exec(`UPDATE entity SET degree = (SELECT COUNT(*) FROM relation r WHERE r.src_id = entity.id OR r.dst_id = entity.id)`);
    const rows = this.db.prepare("SELECT id FROM entity WHERE degree <= 0 AND id NOT IN (SELECT DISTINCT entity_id FROM mention)").all();
    const ids = rows.map((r) => Number(r.id));
    if (ids.length > 0) {
      const ph = ids.map(() => "?").join(",");
      this.db.prepare(`DELETE FROM entity_fts WHERE rowid IN (${ph})`).run(...ids.map(BigInt));
      this.db.prepare(`DELETE FROM entity WHERE id IN (${ph})`).run(...ids.map(BigInt));
    }
    return ids.length;
  }
  counts() {
    const c = (t) => Number(this.db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c);
    return {
      sources: c("source"),
      chunks: c("chunk"),
      entities: c("entity"),
      relations: c("relation"),
      mentions: c("mention"),
      communities: c("community"),
      summaries: c("community_summary")
    };
  }
  // ── 事务 ───────────────────────────────────────────────────────────────────
  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.db.exec("COMMIT");
      return out;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
};
function normOf(name2) {
  return name2.trim().toLowerCase().replace(/[\s`*_\-./\\()[\]{}<>"'!?,;:]+/g, "");
}
function dedupeEdges(edges) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const e of edges) {
    if (seen.has(e.relation.id)) continue;
    seen.add(e.relation.id);
    out.push(e);
  }
  return out;
}

// src/core/lexical.ts
import { DatabaseSync as DatabaseSync2 } from "node:sqlite";
function extractTerms(query) {
  const terms = /* @__PURE__ */ new Set();
  for (const raw of query.split(/[\s\p{P}\p{S}]+/u)) {
    if (raw === "") continue;
    if (/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/.test(raw)) {
      if (raw.length >= 3) {
        for (let i = 0; i + 2 < raw.length; i++) terms.add(raw.slice(i, i + 3));
        if (raw.length === 3) terms.add(raw);
      }
    } else {
      const low = raw.toLowerCase();
      if (low.length >= 3) terms.add(low);
    }
  }
  return [...terms];
}

// src/core/ppr.ts
function runPpr(nodes, edges, seeds, opts = {}) {
  const damping = opts.damping ?? 0.85;
  const maxIter = opts.iterations ?? 20;
  const tol = opts.tolerance ?? 1e-6;
  let seedTotal = 0;
  for (const w of seeds.values()) seedTotal += w;
  if (seedTotal <= 0 || nodes.length === 0) return { scores: /* @__PURE__ */ new Map(), iterations: 0 };
  const adjacency = /* @__PURE__ */ new Map();
  let totalWeight = 0;
  for (const e of edges) {
    for (const [a, b] of [[e.src, e.dst], [e.dst, e.src]]) {
      let list = adjacency.get(a);
      if (!list) {
        list = [];
        adjacency.set(a, list);
      }
      list.push({ dst: b, w: e.weight });
      totalWeight += e.weight;
    }
  }
  const norm = /* @__PURE__ */ new Map();
  for (const [node, list] of adjacency) {
    const sum = list.reduce((acc, x) => acc + x.w, 0);
    if (sum > 0) norm.set(node, sum);
  }
  let ranks = /* @__PURE__ */ new Map();
  for (const n2 of nodes) ranks.set(n2, 0);
  for (const [s, w] of seeds) ranks.set(s, w / seedTotal);
  const jump = /* @__PURE__ */ new Map();
  for (const [s, w] of seeds) jump.set(s, w / seedTotal);
  let iterations = 0;
  for (; iterations < maxIter; iterations++) {
    const next = /* @__PURE__ */ new Map();
    for (const n2 of nodes) next.set(n2, 0);
    let dangling = 0;
    for (const n2 of nodes) {
      const r = ranks.get(n2);
      const list = adjacency.get(n2);
      if (!list || list.length === 0) {
        dangling += r;
        continue;
      }
      const sum = norm.get(n2);
      for (const { dst, w } of list) next.set(dst, (next.get(dst) ?? 0) + r * w / sum);
    }
    const d = damping;
    for (const n2 of nodes) {
      const base = (next.get(n2) ?? 0) + dangling / nodes.length;
      const j = jump.get(n2) ?? 0;
      next.set(n2, d * base + (1 - d) * j);
    }
    let delta = 0;
    for (const n2 of nodes) delta += Math.abs((next.get(n2) ?? 0) - (ranks.get(n2) ?? 0));
    ranks = next;
    if (delta < tol) {
      iterations++;
      break;
    }
  }
  void totalWeight;
  return { scores: ranks, iterations };
}

// src/core/search.ts
function searchLocal(store, question, opts = {}) {
  const seedLimit = opts.seedLimit ?? 12;
  const topK = opts.topK ?? 25;
  const chunkPerEntity = opts.chunkPerEntity ?? 2;
  const maxTokens = opts.maxTokens ?? 6e3;
  const terms = extractTerms(question);
  const seedHits = store.findEntitiesByLexical(terms, seedLimit);
  const chunkHits = store.searchChunks(terms, 8);
  const chunkSeedIds = /* @__PURE__ */ new Set();
  for (const h of chunkHits) for (const id of store.entitiesInChunk(h.chunk.id)) chunkSeedIds.add(id);
  if (seedHits.length === 0 && chunkSeedIds.size === 0) {
    throw new GraphRagError("NO_SEED", `\u8BCD\u6CD5\u672A\u547D\u4E2D\u5B9E\u4F53\uFF08terms=${terms.length}\uFF09`);
  }
  const entities = store.allEntities();
  const relations = store.allRelations();
  const seeds = /* @__PURE__ */ new Map();
  seedHits.forEach((h, i) => seeds.set(h.entity.id, seedLimit - i));
  const chunkCount = /* @__PURE__ */ new Map();
  for (const h of chunkHits) for (const id of store.entitiesInChunk(h.chunk.id)) {
    chunkCount.set(id, (chunkCount.get(id) ?? 0) + 1);
  }
  for (const [id, c] of chunkCount) seeds.set(id, (seeds.get(id) ?? 0) + c);
  const seedHitTotal = (/* @__PURE__ */ new Set([...seedHits.map((h) => h.entity.id), ...chunkSeedIds])).size;
  const { scores, iterations } = runPpr(
    entities.map((e) => e.id),
    relations.map((r) => ({ src: r.srcId, dst: r.dstId, weight: r.weight })),
    seeds,
    opts.ppr
  );
  const topEntities = [...entities].filter((e) => scores.get(e.id) !== void 0).sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)).slice(0, topK);
  const topIds = new Set(topEntities.map((e) => e.id));
  const evidEntities = topEntities.map((e) => ({
    name: e.name,
    type: e.type,
    description: e.description,
    community: e.communityId === null ? null : store.communityOf(e.communityId)?.fingerprint ?? null
  }));
  const edges = store.relationsAmong(topIds, 40);
  const evidRelations = edges.map((e) => ({
    s: e.srcName,
    r: e.relation.type,
    o: e.dstName,
    w: e.relation.weight,
    evidence: [refFor(store, e.relation.srcId)]
  }));
  const chunks = fitTokenBudget(store.chunksForEntities([...topIds], chunkPerEntity), maxTokens).map(toEvidenceChunk);
  const communities = [];
  const seenCommunity = /* @__PURE__ */ new Set();
  for (const e of topEntities) {
    if (e.communityId === null || seenCommunity.has(e.communityId)) continue;
    seenCommunity.add(e.communityId);
    const summary = store.allSummaries().find((s) => s.communityId === e.communityId);
    if (summary) {
      communities.push({ summary: summary.summary, note: "LLM \u751F\u6210\u6458\u8981\uFF0C\u5F15\u7528\u9700\u56DE\u5230 chunks", top: summary.entitiesTop });
    }
    if (communities.length >= 3) break;
  }
  return {
    mode: "local",
    question,
    entities: evidEntities,
    relations: evidRelations,
    chunks,
    communities,
    meta: { mode: "local", seedHits: seedHitTotal, pprIterations: iterations, llmCalls: 0, coverage: coverageOf(store) }
  };
}
var lexicalGlobalScorer = {
  score(question, summaryText) {
    const hay = summaryText.toLowerCase();
    return extractTerms(question).reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
  }
};
function searchGlobal(store, question, opts = {}) {
  const scorer = opts.scorer ?? lexicalGlobalScorer;
  const topN = opts.topCommunities ?? 5;
  const maxTokens = opts.maxTokens ?? 6e3;
  const summaries = store.allSummaries();
  if (summaries.length === 0) throw new GraphRagError("NOT_INDEXED", "\u5C1A\u65E0\u793E\u533A\u6458\u8981\uFF08\u5148\u5EFA\u56FE\u5E76\u751F\u6210\u6458\u8981\uFF09");
  const ranked = summaries.map((s) => ({ s, score: scorer.score(question, s.summary) })).sort((a, b) => b.score - a.score || a.s.communityId - b.s.communityId);
  const picked = summaries.length <= 8 ? ranked : ranked.slice(0, topN);
  const communities = [];
  const entities = [];
  const chunks = [];
  for (const { s } of picked) {
    communities.push({ summary: s.summary, note: "LLM \u751F\u6210\u6458\u8981\uFF0C\u5F15\u7528\u9700\u56DE\u5230 chunks", top: s.entitiesTop });
    for (const e of store.entitiesByCommunity(s.communityId, 12)) {
      entities.push({ name: e.name, type: e.type, description: e.description, community: s.fingerprintAt });
      for (const c of store.chunksForEntities([e.id], 1)) chunks.push(toEvidenceChunk(c));
    }
  }
  return {
    mode: "global",
    question,
    entities,
    relations: [],
    chunks: fitTokenBudget(chunks, maxTokens),
    communities,
    meta: { mode: "global", seedHits: 0, pprIterations: null, llmCalls: 0, coverage: coverageOf(store) }
  };
}
function searchTraversal(store, seed, opts = {}) {
  const direction = opts.direction ?? "both";
  const hops = Math.min(Math.max(opts.hops ?? 2, 1), 10);
  const maxNodes = Math.min(opts.maxNodes ?? 200, 500);
  const exact = store.getEntity(normName(seed));
  let startId;
  if (exact) {
    startId = exact.id;
  } else {
    const fuzzy = store.findEntitiesByLexical(extractTerms(seed), 5);
    if (fuzzy.length === 0) throw new GraphRagError("NO_SEED", `\u672A\u627E\u5230\u5B9E\u4F53\uFF1A${seed}`);
    if (fuzzy.length > 1) {
      return {
        seed,
        resolved: [],
        direction,
        hops,
        nodes: [],
        edges: [],
        truncated: false,
        ambiguousSeeds: fuzzy.map((f) => f.entity.name)
      };
    }
    startId = fuzzy[0].entity.id;
  }
  const rows = store.bfs([startId], hops, direction, opts.relationTypes, maxNodes);
  const nodes = rows.nodes.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    degree: e.degree,
    communityId: e.communityId
  }));
  const edges = rows.edges.map((e) => ({
    srcId: e.relation.srcId,
    dstId: e.relation.dstId,
    s: e.srcName,
    r: e.relation.type,
    o: e.dstName,
    w: e.relation.weight,
    evidence: [refFor(store, e.relation.srcId)]
  }));
  return { seed, resolved: [store.getEntityById(startId)?.name ?? seed], direction, hops, nodes, edges, truncated: rows.truncated, ambiguousSeeds: [] };
}
function refFor(store, entityId) {
  const c = store.evidenceChunkFor(entityId);
  return { path: c?.sourcePath ?? "(\u65E0\u539F\u6587)", lines: c ? `${c.startLine}-${c.endLine}` : "-" };
}
function toEvidenceChunk(c) {
  return { path: c.sourcePath, lines: `${c.startLine}-${c.endLine}`, text: c.text };
}
function fitTokenBudget(chunks, maxTokens) {
  const out = [];
  let used = 0;
  for (const c of chunks) {
    const est = estimateTokens(c.text);
    if (used + est > maxTokens) break;
    out.push(c);
    used += est;
  }
  return out;
}
function coverageOf(store) {
  const c = store.counts();
  return `${c.sources} files / ${c.entities} entities / ${c.relations} relations`;
}

// src/provider.ts
function clampConfig(raw, env = process.env) {
  const model = raw.model != null && typeof raw.model.provider === "string" && raw.model.provider !== "" && typeof raw.model.model === "string" && raw.model.model !== "" ? { provider: raw.model.provider, model: raw.model.model, maxTokens: raw.model.maxTokens } : null;
  return {
    excludes: Array.isArray(raw.excludes) ? raw.excludes.filter((x) => typeof x === "string") : void 0,
    dataDir: resolveDataDir(typeof raw.dataDir === "string" ? raw.dataDir : void 0, env),
    model,
    extract: {
      minConfidence: clampNum(raw.extract?.minConfidence, 0.1, 1, 0.6),
      repairRetries: Math.trunc(clampNum(raw.extract?.repairRetries, 0, 2, 1))
    },
    community: { recomputeThreshold: clampNum(raw.community?.recomputeThreshold, 0, 1, 0.05) },
    chunk: raw.chunk,
    retry: {
      rateLimitRetries: Math.trunc(clampNum(raw.retry?.rateLimitRetries, 0, 5, 3)),
      baseDelayMs: Math.trunc(clampNum(raw.retry?.baseDelayMs, 0, 3e4, 500))
    }
  };
}
function clampNum(v, min, max, dflt) {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
}
function declaredKbsOf(raw) {
  const out = [];
  if (!Array.isArray(raw.kbs)) return out;
  for (const k of raw.kbs) {
    const name2 = typeof k?.name === "string" && k.name.trim() !== "" ? k.name.trim() : null;
    const roots = Array.isArray(k?.roots) ? k.roots.filter((r) => typeof r === "string" && r !== "") : [];
    if (name2 === null || roots.length === 0) continue;
    out.push({ name: name2, roots, description: typeof k?.description === "string" ? k.description : null });
  }
  return out;
}
function summarizerOf(llm) {
  return async ({ members, topEdges }) => {
    const memberText = members.map((m) => `${m.name}\uFF08${m.type}\uFF09${m.description ?? ""}`).join("\n");
    const edgeText = topEdges.map((e) => `${e.s} -[${e.r}]-> ${e.o}`).join("\n");
    const out = await llm.complete(
      '\u4F60\u662F\u77E5\u8BC6\u5E93\u6458\u8981\u5668\u3002\u57FA\u4E8E\u4EE5\u4E0B\u5B9E\u4F53\u3001\u5173\u7CFB\u4E0E\u63CF\u8FF0\uFF0C\u751F\u6210 \u2264150 \u5B57\u7684\u793E\u533A\u4E3B\u9898\u6458\u8981\uFF1A\u8BE5\u793E\u533A\u4EE3\u8868\u4EC0\u4E48\u3001\u5185\u90E8\u4E3B\u8981\u5173\u7CFB\u3001\u4E0E\u5916\u90E8\u7684\u8FB9\u754C\u3002\u4EC5\u8F93\u51FA JSON\uFF1A{"summary":"...","top":["\u4EE3\u8868\u5B9E\u4F53\u540D", ...]}',
      `\u5B9E\u4F53\uFF1A
${memberText}

\u5173\u7CFB\uFF1A
${edgeText}`
    );
    try {
      const parsed = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
      const summary = typeof parsed.summary === "string" ? parsed.summary : out;
      return summary;
    } catch {
      return out;
    }
  };
}
var LocalGraphRagProvider = class {
  constructor(config, deps, declared = []) {
    this.config = config;
    this.deps = deps;
    this.directLlm = deps.llm ?? null;
    this.cachedLlm = this.directLlm !== null ? this.directLlm : void 0;
    mkdirSync2(config.dataDir, { recursive: true });
    this.registry = KbRegistry.load(config.dataDir);
    migrateLegacyWorkspaces(config.dataDir, this.registry, declared[0]?.roots ?? []);
    for (const d of declared) {
      if (this.registry.byName(d.name) === void 0) {
        this.registry.create({ name: d.name, roots: d.roots, description: d.description }, "config");
      }
    }
  }
  config;
  deps;
  id = "local-sqlite";
  registry;
  stores = /* @__PURE__ */ new Map();
  directLlm;
  cachedLlm;
  /** 调用时惰性解析（0.2.0 宿主实测：未 inject 的服务属性访问会抛错，
   * 必须走 reflect.get 非严格读取；且插件 apply 可能早于 llm provide）。 */
  completer() {
    if (this.cachedLlm !== void 0) return this.cachedLlm;
    const ctx = this.deps.ctx;
    const model = this.config.model;
    const llmService = ctx === null ? null : llmServiceOf(ctx);
    if (model === null || llmService === null || ctx === null) {
      this.cachedLlm = null;
      return null;
    }
    this.cachedLlm = llmCompleterOf(ctx, model, this.config.retry);
    return this.cachedLlm;
  }
  // ── KB 管理面 ─────────────────────────────────────────────────────────────
  listKbs() {
    return this.registry.list();
  }
  createKb(input) {
    const kb = this.registry.create({ name: input.name, roots: input.roots, description: input.description ?? null }, "user");
    mkdirSync2(this.kbDir(kb.id), { recursive: true });
    return kb;
  }
  updateKb(id, patch) {
    return this.registry.update(id, patch);
  }
  deleteKb(id) {
    const before = this.storeById(id).counts();
    this.stores.get(id)?.close();
    this.stores.delete(id);
    rmSync2(this.kbDir(id), { recursive: true, force: true });
    this.registry.remove(id);
    return {
      deleted: {
        chunks: before.chunks,
        mentions: before.mentions,
        relations: before.relations,
        entities: before.entities,
        summaries: before.summaries
      },
      communitiesRebuilt: before.communities
    };
  }
  /** KB 解析链（0207 §2.2）：id → name → cwd 命中唯一库 → 唯一库；否则候选。 */
  resolveKb(ref, cwd) {
    if (ref?.id !== void 0 && ref.id !== "") {
      const kb = this.registry.byId(ref.id);
      if (kb === void 0) throw new GraphRagError("KB_AMBIGUOUS", `\u672A\u627E\u5230\u77E5\u8BC6\u5E93 id\uFF1A${ref.id}\uFF1B\u53EF\u7528\uFF1A${this.kbNames()}`);
      return kb;
    }
    if (ref?.name !== void 0 && ref.name !== "") {
      const kb = this.registry.byName(ref.name);
      if (kb === void 0) throw new GraphRagError("KB_AMBIGUOUS", `\u672A\u627E\u5230\u77E5\u8BC6\u5E93\uFF1A${ref.name}\uFF1B\u53EF\u7528\uFF1A${this.kbNames()}`);
      return kb;
    }
    const all = this.registry.list();
    if (all.length === 1) return all[0];
    if (cwd !== void 0) {
      let cwdReal = cwd;
      try {
        cwdReal = realpathSync2(cwd);
      } catch {
      }
      const byCwd = this.registry.byCwd(cwdReal);
      if (byCwd !== void 0) return byCwd;
    }
    if (all.length === 0) throw new GraphRagError("NOT_INDEXED", "\u5C1A\u65E0\u4EFB\u4F55\u77E5\u8BC6\u5E93\uFF1B\u5148\u5728\u9762\u677F\u521B\u5EFA\uFF0C\u6216\u8C03\u7528 graphrag_index\uFF08kb + create\uFF09");
    throw new GraphRagError("KB_AMBIGUOUS", `\u5B58\u5728\u591A\u4E2A\u77E5\u8BC6\u5E93\uFF0C\u8BF7\u6307\u5B9A kb\uFF1A${this.kbNames()}`);
  }
  kbNames() {
    return this.registry.list().map((k) => k.name).join(" / ") || "\uFF08\u65E0\uFF09";
  }
  // ── 按库存储 ──────────────────────────────────────────────────────────────
  kbDir(kbId) {
    return `${this.config.dataDir}/kbs/${kbId}`;
  }
  storeById(kbId) {
    const existing = this.stores.get(kbId);
    if (existing) return existing;
    const dir = this.kbDir(kbId);
    mkdirSync2(dir, { recursive: true });
    const store = new SqliteGraphStore(`${dir}/graphrag.db`);
    this.stores.set(kbId, store);
    return store;
  }
  storeOf(kb) {
    return this.storeById(kb.id);
  }
  dispose() {
    for (const s of this.stores.values()) s.close();
    this.stores.clear();
  }
  // ── 后台索引与进度（0207 §3.2 面板数据源）─────────────────────────────
  progressRecords = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  /** 面板触发的后台索引：立即返回，进度经 progress() 轮询。同库互斥。 */
  indexBackground(target, opts) {
    const kb = this.resolveKb(target);
    const running = this.progressRecords.get(kb.id);
    if (running !== void 0 && running.phase !== "done" && running.phase !== "error") {
      return { started: false };
    }
    if (kb.roots.length === 0) {
      throw new GraphRagError("NOT_AUTHORIZED", `\u77E5\u8BC6\u5E93\u300C${kb.name}\u300D\u672A\u914D\u7F6E\u6388\u6743 roots\uFF1B\u8BF7\u5728\u9762\u677F\u6216\u914D\u7F6E\u4E2D\u6DFB\u52A0`);
    }
    const llm = this.completer();
    if (llm === null) {
      throw new GraphRagError("NO_PROVIDER", "\u6A21\u578B provider \u4E0D\u53EF\u7528\uFF08\u5BBF\u4E3B\u672A\u914D\u7F6E llm \u6216\u63D2\u4EF6\u672A\u914D\u7F6E model\uFF09");
    }
    const store = this.storeOf(kb);
    if (opts.retryQuarantined) {
      for (const s of store.listSources()) {
        if (s.state === "quarantined") store.setSourceState(s.id, "pending");
      }
      for (const q of store.quarantineList()) store.quarantineResolve(q.id);
    }
    const record = {
      kbId: kb.id,
      kbName: kb.name,
      phase: "scanning",
      filesDone: 0,
      filesTotal: 0,
      currentFile: null,
      llmCalls: 0,
      tokensIn: 0,
      tokensOut: 0,
      quarantined: 0,
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
      report: null
    };
    this.progressRecords.set(kb.id, record);
    const controller = new AbortController();
    this.controllers.set(kb.id, controller);
    const cfg = {
      authorizedRoots: [...kb.roots],
      roots: opts.roots,
      excludes: this.config.excludes,
      chunk: this.config.chunk,
      extract: this.config.extract,
      community: this.config.community
    };
    void runIngest(store, cfg, { llm, summarize: summarizerOf(llm) }, controller.signal, (p) => {
      record.phase = p.phase;
      record.filesDone = p.filesDone;
      record.filesTotal = p.filesTotal;
      record.currentFile = p.currentFile ?? null;
      record.quarantined = p.quarantined;
    }).then((report) => {
      record.phase = "done";
      record.report = report;
      record.finishedAt = Date.now();
      store.setMeta("last-index-at", String(record.finishedAt));
      this.registry.touchIndexed(kb.id, record.finishedAt);
    }).catch((err) => {
      record.phase = "error";
      record.error = err instanceof Error ? err.message : String(err);
      record.finishedAt = Date.now();
    }).finally(() => {
      this.controllers.delete(kb.id);
    });
    return { started: true };
  }
  progress(kbId) {
    return this.progressRecords.get(kbId) ?? null;
  }
  cancelIndex(kbId) {
    const controller = this.controllers.get(kbId);
    if (controller === void 0) return false;
    controller.abort();
    return true;
  }
  // ── 状态（单库 / 总览）────────────────────────────────────────────────────
  statusOf(kb) {
    const store = this.storeOf(kb);
    const sources = store.listSources();
    const c = store.counts();
    return {
      provider: this.id,
      kbName: kb.name,
      files: {
        indexed: sources.filter((s) => s.state === "merged").length,
        stale: sources.filter((s) => s.state !== "merged" && s.state !== "deleted").length,
        quarantined: sources.filter((s) => s.state === "quarantined").length,
        skippedBinary: sources.filter((s) => s.error === "skipped-binary").length
      },
      graph: { entities: c.entities, relations: c.relations, communities: c.communities },
      lastIndexAt: kb.lastIndexedAt,
      staleness: { changedSinceIndex: sources.filter((s) => s.state === "pending" || s.state === "extracting").length },
      llmAvailable: this.completer() !== null,
      kbsOverview: []
    };
  }
  async status(target) {
    if (target !== void 0 && (target.id !== void 0 || target.name !== void 0)) {
      return this.statusOf(this.resolveKb(target));
    }
    const kbs = this.registry.list();
    let indexed = 0;
    let stale = 0;
    let quarantined = 0;
    let skipped = 0;
    let entities = 0;
    let relations = 0;
    let communities = 0;
    const overview = kbs.map((kb) => {
      const store = this.storeOf(kb);
      const sources = store.listSources();
      const c = store.counts();
      const kbIndexed = sources.filter((s) => s.state === "merged").length;
      indexed += kbIndexed;
      stale += sources.filter((s) => s.state !== "merged" && s.state !== "deleted").length;
      quarantined += sources.filter((s) => s.state === "quarantined").length;
      skipped += sources.filter((s) => s.error === "skipped-binary").length;
      entities += c.entities;
      relations += c.relations;
      communities += c.communities;
      return { name: kb.name, filesIndexed: kbIndexed, entities: c.entities, lastIndexAt: kb.lastIndexedAt };
    });
    return {
      provider: this.id,
      kbName: null,
      files: { indexed, stale, quarantined, skippedBinary: skipped },
      graph: { entities, relations, communities },
      lastIndexAt: null,
      staleness: { changedSinceIndex: 0 },
      llmAvailable: this.completer() !== null,
      kbsOverview: overview
    };
  }
  // ── 索引 / 查询 / 遍历 / 遗忘 ─────────────────────────────────────────────
  async index(target, opts, signal) {
    const kb = this.resolveKb(target);
    if (kb.roots.length === 0) {
      throw new GraphRagError("NOT_AUTHORIZED", `\u77E5\u8BC6\u5E93\u300C${kb.name}\u300D\u672A\u914D\u7F6E\u6388\u6743 roots\uFF1B\u8BF7\u5728\u9762\u677F\u6216\u914D\u7F6E\u4E2D\u6DFB\u52A0`);
    }
    const llm = this.completer();
    if (llm === null) {
      throw new GraphRagError("NO_PROVIDER", "\u6A21\u578B provider \u4E0D\u53EF\u7528\uFF08\u5BBF\u4E3B\u672A\u914D\u7F6E llm \u6216\u63D2\u4EF6\u672A\u914D\u7F6E model\uFF09\uFF1B\u8BCD\u6CD5\u68C0\u7D22\u4E0E\u904D\u5386\u4E0D\u53D7\u5F71\u54CD");
    }
    const store = this.storeOf(kb);
    if (opts.retryQuarantined) {
      for (const s of store.listSources()) {
        if (s.state === "quarantined") store.setSourceState(s.id, "pending");
      }
      for (const q of store.quarantineList()) store.quarantineResolve(q.id);
    }
    const cfg = {
      authorizedRoots: [...kb.roots],
      roots: opts.roots,
      excludes: this.config.excludes,
      chunk: this.config.chunk,
      extract: this.config.extract,
      community: this.config.community
    };
    const report = await runIngest(store, cfg, { llm, summarize: summarizerOf(llm) }, signal);
    const finished = Date.now();
    store.setMeta("last-index-at", String(finished));
    this.registry.touchIndexed(kb.id, finished);
    return report;
  }
  async query(target, q) {
    const kb = this.resolveKb(target);
    const store = this.storeOf(kb);
    if (store.counts().sources === 0) {
      throw new GraphRagError("NOT_INDEXED", `\u77E5\u8BC6\u5E93\u300C${kb.name}\u300D\u5C1A\u672A\u5EFA\u7ACB\u56FE\u8C31\uFF1B\u5148\u8C03\u7528 graphrag_index\uFF08\u9700\u5BA1\u6279\uFF09`);
    }
    if (q.mode === "global") return searchGlobal(store, q.question, { maxTokens: q.maxTokens });
    return searchLocal(store, q.question, { maxTokens: q.maxTokens });
  }
  async traverse(target, t) {
    const kb = this.resolveKb(target);
    const store = this.storeOf(kb);
    if (store.counts().sources === 0) {
      throw new GraphRagError("NOT_INDEXED", `\u77E5\u8BC6\u5E93\u300C${kb.name}\u300D\u5C1A\u672A\u5EFA\u7ACB\u56FE\u8C31\uFF1B\u5148\u8C03\u7528 graphrag_index\uFF08\u9700\u5BA1\u6279\uFF09`);
    }
    return searchTraversal(store, t.seed, t);
  }
  async forget(target, inner) {
    return this.storeOf(this.resolveKb(target)).forget(inner);
  }
  estimate(target, opts) {
    const kb = this.resolveKb(target);
    if (kb.roots.length === 0) return { files: 0, estCalls: 0 };
    const roots = opts.roots ?? kb.roots;
    const scan = scanRoots(roots, kb.roots, this.config.excludes);
    const store = this.storeOf(kb);
    const dirty = diffAgainstIndex(scan.files, store.listSources());
    const resumeCount = store.listSources().filter((s) => ["pending", "chunked", "extracting", "extracted", "failed"].includes(s.state) && scan.files.some((f) => f.path === s.path)).length;
    const files = dirty.added.length + dirty.changed.length + resumeCount;
    return { files, estCalls: files + Math.ceil(files * 0.1) };
  }
};
var name = "dsh-kylin-vibe/provider";
var inject = ["graphrag"];
function apply(ctx, rawConfig = {}) {
  const mounted = ctx;
  const service = mounted.graphrag;
  if (service === void 0) {
    ctx.logger?.warn("dsh-kylin-vibe/provider: seam \u672A\u6302\u8F7D\uFF08graphrag \u884C\u7F3A\u5931\u6216\u672A\u5148\u52A0\u8F7D\uFF09\uFF0Cprovider \u672A\u6CE8\u518C");
    return;
  }
  const config = clampConfig(rawConfig);
  const provider = new LocalGraphRagProvider(config, { ctx }, declaredKbsOf(rawConfig));
  ctx.effect(() => service.register(provider), "dsh-kylin-vibe: provider registration");
}
export {
  LocalGraphRagProvider,
  apply,
  clampConfig,
  declaredKbsOf,
  inject,
  name
};
//# sourceMappingURL=provider.js.map
