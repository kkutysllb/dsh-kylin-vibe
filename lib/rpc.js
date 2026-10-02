import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// src/core/types.ts
var GraphRagError = class extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.code = code;
    this.name = "GraphRagError";
  }
  code;
};

// src/rpc.ts
var RPC_CHANNEL = "/dsh-kylin-vibe";
var MAX_STRING = 4e3;
var RPC_BODY_LIMIT_BYTES = 1 * 1024 * 1024;
function ok(value) {
  return { ok: true, value };
}
function fail(code, message) {
  return { ok: false, error: { code, message } };
}
function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GraphRagError("INVALID", `${label} must be an object`);
  }
  return value;
}
function string(value, label, max = MAX_STRING) {
  if (typeof value !== "string") throw new GraphRagError("INVALID", `${label} must be a string`);
  if (value.length > max) throw new GraphRagError("INVALID", `${label} exceeds ${max} chars`);
  return value;
}
function optionalString(value, label) {
  return value === void 0 ? void 0 : string(value, label);
}
function stringArray(value, label, max = 64) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new GraphRagError("INVALID", `${label} must be an array`);
  if (value.length > max) throw new GraphRagError("INVALID", `${label} exceeds ${max} items`);
  return value.map((item) => string(item, label, MAX_STRING));
}
function bool(value, fallback) {
  return value === void 0 ? fallback : value === true;
}
function toErrorResult(error) {
  if (error instanceof GraphRagError) return fail(error.code, error.message);
  return fail("internal", error instanceof Error ? error.message : String(error));
}
function registerKbRpc(ctx, resolve) {
  return ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: RPC_CHANNEL,
    handler: (req, res) => {
      void serveRpcRequest(ctx, resolve, req, res);
    }
  }), "dsh-kylin-vibe: rpc channel");
}
async function serveRpcRequest(ctx, resolve, req, res) {
  const reply = (status, payload) => {
    res.writeHead(status, { "content-type": "application/json", connection: "close" });
    res.end(JSON.stringify(payload));
  };
  const connection = ctx.connection;
  const rejection = connection?.requestRejection?.(req);
  if (rejection !== void 0) {
    res.writeHead(rejection);
    res.end(rejection === 401 ? "unauthorized" : "forbidden");
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "text/plain" });
    res.end("method not allowed");
    return;
  }
  const url = new URL(req.url ?? "/", "http://dsh.internal");
  const endpoint = url.pathname === RPC_CHANNEL ? "" : url.pathname.startsWith(`${RPC_CHANNEL}/`) ? url.pathname.slice(RPC_CHANNEL.length + 1) : void 0;
  if (endpoint === void 0 || !/^[A-Za-z0-9_$.:-]+$/.test(endpoint)) {
    reply(404, { type: "server-response", rpcId: "invalid-request", result: fail("not-found", "unknown endpoint") });
    return;
  }
  const contentType = String(req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    reply(415, { type: "server-response", rpcId: "invalid-request", result: fail("INVALID", "content type must be application/json") });
    return;
  }
  const declared = req.headers["content-length"];
  if (declared !== void 0 && Number(declared) > RPC_BODY_LIMIT_BYTES) {
    res.writeHead(413, { connection: "close" });
    res.end();
    return;
  }
  let raw = "";
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });
  try {
    let received = 0;
    for await (const chunk of req) {
      received += chunk.byteLength;
      if (received > RPC_BODY_LIMIT_BYTES) throw new Error("body too large");
      raw += String(chunk);
    }
  } catch {
    res.writeHead(400, { connection: "close" });
    res.end("body read failure");
    req.destroy();
    return;
  }
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    reply(400, { type: "server-response", rpcId: "invalid-request", result: fail("INVALID", "body is not JSON") });
    return;
  }
  if (envelope?.type !== "client-request" || typeof envelope.rpcId !== "string" || typeof envelope.method !== "string") {
    reply(200, {
      type: "server-response",
      rpcId: typeof envelope?.rpcId === "string" ? envelope.rpcId : "invalid-request",
      result: fail("INVALID", "invalid client-request message")
    });
    return;
  }
  if (envelope.method !== endpoint) {
    reply(200, { type: "server-response", rpcId: envelope.rpcId, result: fail("INVALID", "method does not match endpoint") });
    return;
  }
  const result = await handleKbRpc(resolve, envelope.method, envelope.payload, abort.signal);
  reply(200, { type: "server-response", rpcId: envelope.rpcId, result });
}
async function handleKbRpc(resolve, endpoint, payload, _signal) {
  try {
    const provider = resolve();
    const body = payload === void 0 ? {} : record(payload, "payload");
    switch (endpoint) {
      case "snapshot": {
        const kbs = provider.listKbs();
        const withStats = await Promise.all(kbs.map(async (kb) => {
          const status = await provider.status({ id: kb.id });
          return {
            ...kb,
            filesIndexed: status.files.indexed,
            stale: status.files.stale,
            entities: status.graph.entities,
            relations: status.graph.relations,
            communities: status.graph.communities,
            progress: provider.progress(kb.id)
          };
        }));
        return ok({ kbs: withStats });
      }
      case "createKb": {
        const name2 = string(body["name"], "name", 120);
        const roots = stringArray(body["roots"], "roots", 16);
        const description = optionalString(body["description"], "description");
        if (roots.length === 0) return fail("INVALID", "roots \u4E0D\u80FD\u4E3A\u7A7A");
        return ok(provider.createKb({ name: name2, roots, description }));
      }
      case "updateKb": {
        const id = string(body["id"], "id", 120);
        const name2 = optionalString(body["name"], "name");
        const roots = body["roots"] === void 0 ? void 0 : stringArray(body["roots"], "roots", 16);
        const description = body["description"] === void 0 ? void 0 : optionalString(body["description"], "description");
        return ok(provider.updateKb(id, { name: name2, roots, description }));
      }
      case "deleteKb": {
        const id = string(body["id"], "id", 120);
        return ok(await provider.deleteKb(id));
      }
      case "index": {
        const id = string(body["id"], "id", 120);
        const retryQuarantined = bool(body["retryQuarantined"], false);
        return ok(provider.indexBackground({ id }, { retryQuarantined }));
      }
      case "cancel": {
        const id = string(body["id"], "id", 120);
        return ok({ cancelled: provider.cancelIndex(id) });
      }
      case "progress": {
        const id = string(body["id"], "id", 120);
        const progress = provider.progress(id);
        return ok({ progress });
      }
      case "browse": {
        const id = string(body["id"], "id", 120);
        const query = optionalString(body["query"], "query") ?? "";
        const limit = Math.min(Math.max(Number(body["limit"] ?? 30) || 30, 1), 100);
        return ok(provider.browseEntities({ id }, query, limit));
      }
      case "sampleReview": {
        const id = string(body["id"], "id", 120);
        const limit = Math.min(Math.max(Number(body["limit"] ?? 20) || 20, 1), 50);
        return ok(provider.sampleForReview({ id }, limit));
      }
      case "sources": {
        const id = string(body["id"], "id", 120);
        return ok(provider.listKnowledge({ id }));
      }
      case "forgetFile": {
        const id = string(body["id"], "id", 120);
        const path = string(body["path"], "path", 400);
        return ok(await provider.forgetKnowledge({ id }, path));
      }
      case "reindexSource": {
        const id = string(body["id"], "id", 120);
        const path = string(body["path"], "path", 400);
        return ok(provider.reindexKnowledge({ id }, path));
      }
      case "setSourceEnabled": {
        const id = string(body["id"], "id", 120);
        const path = string(body["path"], "path", 400);
        const enabled = body["enabled"] === true;
        return ok(provider.setKnowledgeEnabled({ id }, path, enabled));
      }
      case "importFiles": {
        const id = string(body["id"], "id", 120);
        const dir = string(body["dir"], "dir", 500);
        if (!dir.startsWith("/")) return fail("INVALID", "dir must be an absolute path");
        return ok(provider.importDirectory({ id }, dir));
      }
      case "changes": {
        const id = string(body["id"], "id", 120);
        return ok(provider.changesPreview({ id }));
      }
      case "expand": {
        const id = string(body["id"], "id", 120);
        const nodeId = Number(body["nodeId"]);
        if (!Number.isSafeInteger(nodeId) || nodeId <= 0) return fail("INVALID", "nodeId must be a positive integer");
        return ok(provider.expandNode({ id }, nodeId));
      }
      case "recall": {
        const id = string(body["id"], "id", 120);
        const question = string(body["question"], "question", 2e3);
        const topK = Math.min(Math.max(Number(body["topK"] ?? 12) || 12, 5), 50);
        return ok(await provider.query({ id }, { question, mode: "local", topK }));
      }
      case "addText": {
        const id = string(body["id"], "id", 120);
        const title = string(body["title"], "title", 120);
        const text = string(body["text"], "text", 5e4);
        if (text.trim() === "") return fail("INVALID", "text must not be empty");
        return ok(provider.addTextKnowledge({ id }, title, text));
      }
      case "correctFromSelection": {
        const text = string(body["text"], "text", 2e3);
        return ok(await provider.correctFromSelection(typeof body["id"] === "string" ? { id: body["id"] } : void 0, text));
      }
      case "review": {
        const id = string(body["id"], "id", 120);
        const relationId = Number(body["relationId"]);
        if (!Number.isSafeInteger(relationId) || relationId <= 0) return fail("INVALID", "relationId must be a positive integer");
        const verdict = body["verdict"];
        if (verdict !== "correct" && verdict !== "wrong" && verdict !== "unsure") return fail("INVALID", "verdict must be correct|wrong|unsure");
        let correction;
        const raw = body["correction"];
        if (typeof raw === "object" && raw !== null) {
          const c = raw;
          correction = {
            s: typeof c["s"] === "string" ? c["s"].slice(0, 200) : void 0,
            r: typeof c["r"] === "string" ? c["r"].slice(0, 120) : void 0,
            o: typeof c["o"] === "string" ? c["o"].slice(0, 200) : void 0
          };
        }
        return ok(provider.reviewRelation({ id }, relationId, verdict, correction));
      }
      case "health": {
        const id = string(body["id"], "id", 120);
        return ok(provider.healthReport({ id }));
      }
      default:
        return fail("not-found", `unknown endpoint: ${endpoint}`);
    }
  } catch (error) {
    return toErrorResult(error);
  }
}
var name = "dsh-kylin-vibe/rpc";
var inject = ["graphrag", "webServer", "connection"];
function apply(ctx) {
  const mounted = ctx;
  const service = mounted.graphrag;
  if (service === void 0) {
    ctx.logger?.warn("dsh-kylin-vibe/rpc: seam \u672A\u6302\u8F7D\uFF0CRPC \u901A\u9053\u672A\u6CE8\u518C");
    return;
  }
  let provider;
  try {
    provider = service.resolve();
  } catch (error) {
    ctx.logger?.warn(`dsh-kylin-vibe/rpc: provider \u4E0D\u53EF\u7528\uFF0CRPC \u901A\u9053\u672A\u6CE8\u518C: ${String(error)}`);
    return;
  }
  ctx.effect(() => registerKbRpc(ctx, () => provider), "dsh-kylin-vibe: rpc registration");
}
export {
  RPC_CHANNEL,
  apply,
  handleKbRpc,
  inject,
  name,
  registerKbRpc
};
//# sourceMappingURL=rpc.js.map
