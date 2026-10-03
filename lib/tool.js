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

// src/adapter.ts
function callerFrom(exec) {
  const agent = exec?.agent;
  const id = agent?.session?.id;
  const cwd = agent?.session?.header?.cwd;
  const out = {};
  if (typeof id === "string") out.sessionId = id;
  if (typeof cwd === "string") out.cwd = cwd;
  return out;
}

// src/tool.ts
var ERROR_TEXT = {
  NOT_AUTHORIZED: "\u8BE5\u8DEF\u5F84\u672A\u88AB\u6388\u6743\u7D22\u5F15\uFF1B\u8BF7\u8BA9\u7528\u6237\u5728\u914D\u7F6E\uFF08cordis.patch.yml \u7684 graphrag-provider-local \u884C\uFF09\u4E2D\u6DFB\u52A0 roots \u540E\u91CD\u8BD5\u3002",
  NOT_INDEXED: "\u5DE5\u4F5C\u533A\u5C1A\u672A\u5EFA\u7ACB\u56FE\u8C31\uFF1B\u5148\u8C03\u7528 graphrag_index\uFF08\u9700\u7528\u6237\u5BA1\u6279\uFF09\u3002",
  INDEX_IN_PROGRESS: "\u7D22\u5F15\u8FDB\u884C\u4E2D\uFF1B\u7A0D\u540E\u91CD\u8BD5\uFF0C\u6216\u5148\u7528 graphrag_status \u67E5\u770B\u8FDB\u5EA6\u3002",
  NO_SEED: "\u68C0\u7D22\u8BCD\u672A\u547D\u4E2D\u4EFB\u4F55\u5B9E\u4F53\uFF1B\u6362\u4E00\u79CD\u8868\u8FF0\uFF0C\u6216\u5148\u7528 grep \u5B9A\u4F4D\u5B9E\u4F53\u540D\uFF0C\u518D\u7528 graphrag_graph \u4ECE\u8BE5\u5B9E\u4F53\u904D\u5386\u3002",
  AMBIGUOUS_SEED: "\u79CD\u5B50\u540D\u547D\u4E2D\u591A\u4E2A\u5B9E\u4F53\uFF08\u89C1\u8FD4\u56DE\u7684 ambiguousSeeds\uFF09\uFF1B\u7528\u66F4\u7CBE\u786E\u7684\u540D\u79F0\u91CD\u8BD5\u3002",
  KB_AMBIGUOUS: "\u77E5\u8BC6\u5E93\u5B9A\u4F4D\u4E0D\u660E\u786E\uFF08\u89C1\u9519\u8BEF\u8BE6\u60C5\u4E2D\u7684\u5019\u9009\u540D\u5355\uFF09\uFF1B\u7528 kb \u53C2\u6570\u6307\u5B9A\u786E\u5207\u540D\u79F0\u91CD\u8BD5\u3002",
  INVALID: "\u53C2\u6570\u4E0D\u5408\u6CD5\uFF08\u89C1\u9519\u8BEF\u8BE6\u60C5\uFF09\u3002",
  QUARANTINED: "\u90E8\u5206\u5185\u5BB9\u62BD\u53D6\u5931\u8D25\u88AB\u9694\u79BB\uFF1B\u53EF\u7528 graphrag_index \u4E14 retryQuarantined=true \u91CD\u653E\u3002",
  NO_PROVIDER: "\u5BBF\u4E3B\u672A\u914D\u7F6E\u6A21\u578B provider\uFF1B\u7D22\u5F15\u4E0E\u6458\u8981\u4E0D\u53EF\u7528\uFF0C\u8BCD\u6CD5\u68C0\u7D22\u4E0E\u56FE\u904D\u5386\u4E0D\u53D7\u5F71\u54CD\u3002",
  MISSING_CREDENTIAL: "\u5BBF\u4E3B\u6A21\u578B\u51ED\u636E\u7F3A\u5931\uFF1B\u8BF7\u8BA9\u7528\u6237\u5728\u5BBF\u4E3B\u6A21\u578B\u8BBE\u7F6E\u4E2D\u8865\u5168\u3002",
  ABORTED: "\u5DF2\u4E2D\u6B62\uFF1B\u7D22\u5F15\u8FDB\u5EA6\u5DF2\u5B58\u6863\uFF0C\u53EF\u518D\u6B21 graphrag_index \u7EED\u8DD1\u3002",
  LLM_TIMEOUT: "\u6A21\u578B\u8C03\u7528\u8D85\u65F6\uFF08\u8BE5\u6587\u4EF6\u5DF2\u8DF3\u8FC7\u5E76\u6807\u8BB0\u5931\u8D25\uFF09\uFF1B\u7D22\u5F15\u4F1A\u7EE7\u7EED\u5904\u7406\u5176\u4F59\u6587\u4EF6\uFF0C\u7A0D\u540E\u53EF\u5355\u72EC\u91CD\u8BD5\u3002",
  CONTEXT_WINDOW: "\u6587\u672C\u5757\u8D85\u51FA\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF08\u5DF2\u81EA\u52A8\u5BF9\u534A\u7EC6\u5206\u91CD\u8BD5\u4E00\u6B21\uFF09\uFF1B\u4ECD\u5931\u8D25\u5219\u8BE5\u6587\u4EF6\u6807\u8BB0\u5931\u8D25\uFF0C\u7D22\u5F15\u7EE7\u7EED\u3002",
  SCHEMA_FUTURE: "\u56FE\u8C31\u6570\u636E\u7531\u66F4\u65B0\u7248\u672C\u7684\u63D2\u4EF6\u521B\u5EFA\uFF1B\u8BF7\u5148\u5347\u7EA7\u63D2\u4EF6\u3002"
};
var CALLER_CWD_MESSAGE = "\u65E0\u6CD5\u5B9A\u4F4D\u8C03\u7528\u8005\u5DE5\u4F5C\u533A\uFF08\u9700\u8981\u6D3B\u8DC3\u4F1A\u8BDD\uFF09(the caller workspace is unresolvable)";
var ToolRejection = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ToolRejection";
  }
  code;
};
function toolEnvelope(error) {
  if (error instanceof ToolRejection) return { ok: false, error: { code: error.code, message: error.message } };
  if (error instanceof GraphRagError) {
    return { ok: false, error: { code: error.code, message: `${ERROR_TEXT[error.code]}\uFF08${error.message}\uFF09` } };
  }
  return { ok: false, error: { code: "internal", message: error instanceof Error ? error.message : String(error) } };
}
function requireCallerCwd(caller) {
  if (caller.cwd === void 0) throw new ToolRejection("no-session", CALLER_CWD_MESSAGE);
  return caller.cwd;
}
function kbRefOf(a) {
  return typeof a["kb"] === "string" && a["kb"].trim() !== "" ? { name: a["kb"].trim() } : void 0;
}
var jsonRender = (_args, value) => [
  { type: "text", text: JSON.stringify(value, null, 2) }
];
function renderEvidencePack(_args, value) {
  const pack = value;
  if (pack === null || typeof pack !== "object" || !Array.isArray(pack.chunks) || !Array.isArray(pack.entities)) {
    return [{ type: "text", text: JSON.stringify(value, null, 2) }];
  }
  const bounded = {
    ...pack,
    chunks: pack.chunks.map((c) => ({ ...c, text: c.text.length > 4e3 ? `${c.text.slice(0, 4e3)}\u2026[\u622A\u65AD]` : c.text }))
  };
  return [{ type: "text", text: JSON.stringify(bounded, null, 2) }];
}
var outputObject = { schema: { type: "object" } };
function graphragToolDefs(services, config = {}) {
  const resolve = () => services.resolve(config.providerPin);
  const queryDef = {
    name: "graphrag_query",
    description: "\u5728\u5DF2\u7D22\u5F15\u7684\u5DE5\u4F5C\u533A\u77E5\u8BC6\u56FE\u8C31\u4E0A\u68C0\u7D22\u8BC1\u636E\u3002\u5173\u7CFB\u6027\u95EE\u9898\uFF08X \u5982\u4F55\u5F71\u54CD Y\u3001X \u4E0E Y \u7684\u5173\u8054\u673A\u5236\uFF09\u7528 mode=local\uFF1B\u5168\u5C40\u6027\u95EE\u9898\uFF08\u6574\u4F53\u67B6\u6784\u3001\u4E3B\u8981\u6A21\u5757\u5212\u5206\u3001\u8BBE\u8BA1\u601D\u8DEF\uFF09\u7528 mode=global\u3002\u8FD4\u56DE\u7ED3\u6784\u5316\u8BC1\u636E\u5305\uFF1Achunks \u662F\u539F\u6587\u4E00\u7EA7\u8BC1\u636E\uFF08\u5F15\u7528\u7ED3\u8BBA\u5FC5\u987B\u843D\u5230\u5176 path+lines\uFF09\uFF0Centities/relations/communities \u662F\u8F85\u52A9\u7406\u89E3\u7684\u7ED3\u6784\u5C42\u3002",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "\u81EA\u7136\u8BED\u8A00\u95EE\u9898\uFF08\u2264500 \u5B57\uFF09" },
        mode: { type: "string", enum: ["local", "global"], description: "\u7F3A\u7701 local\uFF1Alocal=\u5173\u7CFB/\u5B9E\u4F53\u7EA7\u68C0\u7D22\uFF08\u96F6 LLM\uFF09\uFF1Bglobal=\u793E\u533A\u6458\u8981\u5168\u5C40\u68C0\u7D22" },
        maxTokens: { type: "number", description: "\u8BC1\u636E\u5305 token \u9884\u7B97\uFF0C\u7F3A\u7701 6000\uFF0C\u4E0A\u9650 12000" },
        kb: { type: "string", description: "\u53EF\u9009\uFF1A\u77E5\u8BC6\u5E93\u540D\uFF1B\u7F3A\u7701\u6309\u5DE5\u4F5C\u533A\u81EA\u52A8\u5339\u914D\uFF08\u591A\u5E93\u65F6\u5FC5\u987B\u6307\u5B9A\uFF09" }
      },
      required: ["question"]
    },
    output: { schema: outputObject.schema, render: renderEvidencePack },
    timeoutMs: 12e4,
    execute: async (args, exec) => {
      const caller = callerFrom(exec);
      try {
        const cwd = requireCallerCwd(caller);
        const a = args;
        const question = a["question"];
        if (typeof question !== "string" || question.trim() === "") {
          throw new ToolRejection("invalid", "question \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
        }
        const mode = a["mode"] === "global" ? "global" : "local";
        const maxTokens = typeof a["maxTokens"] === "number" ? Math.min(Math.max(a["maxTokens"], 1e3), 12e3) : void 0;
        const pack = await resolve().query(kbRefOf(a), { question: question.slice(0, 500), mode, maxTokens }, cwd);
        return { ok: true, value: pack };
      } catch (error) {
        return toolEnvelope(error);
      }
    }
  };
  const graphDef = {
    name: "graphrag_graph",
    description: "\u4ECE\u5B9E\u4F53\u51FA\u53D1\u505A\u591A\u8DF3\u56FE\u904D\u5386\uFF1A\u5F71\u54CD\u9762\u5206\u6790\u7528 direction=in\uFF08\u53CD\u67E5\u8C01\u4F9D\u8D56\u5B83\uFF09\u3001\u8C03\u7528\u94FE\u8FFD\u8E2A\u7528 out\u3002\u4E0D\u8C03\u7528 LLM\uFF0C\u8FD4\u56DE\u7ED3\u6784\u5316\u5B50\u56FE\uFF08\u8282\u70B9/\u8FB9/\u6BCF\u8FB9\u4E00\u6761\u539F\u6587\u5F15\u7528\uFF09\u3002",
    parameters: {
      type: "object",
      properties: {
        seed: { type: "string", description: "\u5B9E\u4F53\u540D\u6216\u522B\u540D" },
        direction: { type: "string", enum: ["out", "in", "both"], description: "\u7F3A\u7701 both\uFF1Bin = \u53CD\u5411\u5F71\u54CD\uFF08\u8C01\u4F9D\u8D56\u5B83\uFF09" },
        hops: { type: "number", description: "1..4\uFF0C\u7F3A\u7701 2" },
        relationTypes: { type: "array", items: { type: "string" }, description: '\u8FC7\u6EE4\u8FB9\u7C7B\u578B\uFF0C\u5982 ["calls","imports"]' },
        maxNodes: { type: "number", description: "\u7F3A\u7701 200\uFF0C\u4E0A\u9650 500" },
        kb: { type: "string", description: "\u53EF\u9009\uFF1A\u77E5\u8BC6\u5E93\u540D\uFF1B\u7F3A\u7701\u6309\u5DE5\u4F5C\u533A\u81EA\u52A8\u5339\u914D\uFF08\u591A\u5E93\u65F6\u5FC5\u987B\u6307\u5B9A\uFF09" }
      },
      required: ["seed"]
    },
    output: { schema: outputObject.schema, render: jsonRender },
    timeoutMs: 3e4,
    execute: async (args, exec) => {
      const caller = callerFrom(exec);
      try {
        const cwd = requireCallerCwd(caller);
        const a = args;
        const seed = a["seed"];
        if (typeof seed !== "string" || seed.trim() === "") {
          throw new ToolRejection("invalid", "seed \u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
        }
        const direction = a["direction"] === "out" || a["direction"] === "in" ? a["direction"] : "both";
        const hops = typeof a["hops"] === "number" ? Math.min(Math.max(Math.trunc(a["hops"]), 1), 4) : 2;
        const maxNodes = typeof a["maxNodes"] === "number" ? Math.min(Math.max(Math.trunc(a["maxNodes"]), 1), 500) : void 0;
        const relationTypes = Array.isArray(a["relationTypes"]) ? a["relationTypes"].filter((t) => typeof t === "string") : void 0;
        const sub = await resolve().traverse(kbRefOf(a), { seed: seed.slice(0, 200), direction, hops, relationTypes, maxNodes }, cwd);
        return { ok: true, value: sub };
      } catch (error) {
        return toolEnvelope(error);
      }
    }
  };
  const statusDef = {
    name: "graphrag_status",
    description: '\u67E5\u770B\u77E5\u8BC6\u56FE\u8C31\u7D22\u5F15\u72B6\u6001\uFF1A\u8986\u76D6\u6587\u4EF6\u6570\u3001\u5B9E\u4F53/\u5173\u7CFB/\u793E\u533A\u89C4\u6A21\u3001\u6700\u540E\u7D22\u5F15\u65F6\u95F4\u3001\u9648\u65E7\u5EA6\u3001\u9694\u79BB\u533A\u8BA1\u6570\u3001\u6A21\u578B\u53EF\u7528\u6027\u3002\u4E0D\u4F20 kb \u65F6\u5217\u51FA\u5168\u90E8\u77E5\u8BC6\u5E93\u6982\u89C8\u3002\u56DE\u7B54"\u56FE\u8C31\u80FD\u4E0D\u80FD\u4FE1/\u8981\u4E0D\u8981\u91CD\u5EFA"\u7684\u95EE\u9898\u3002',
    parameters: {
      type: "object",
      properties: {
        kb: { type: "string", description: "\u53EF\u9009\uFF1A\u77E5\u8BC6\u5E93\u540D\uFF1B\u7F3A\u7701\u5217\u51FA\u5168\u90E8\u77E5\u8BC6\u5E93\u6982\u89C8" }
      }
    },
    output: { schema: outputObject.schema, render: jsonRender },
    timeoutMs: 15e3,
    execute: async (args, exec) => {
      const caller = callerFrom(exec);
      try {
        requireCallerCwd(caller);
        const a = args ?? {};
        const status = await resolve().status(kbRefOf(a));
        return { ok: true, value: status };
      } catch (error) {
        return toolEnvelope(error);
      }
    }
  };
  const indexDef = {
    name: "graphrag_index",
    description: "\u5728\u540E\u53F0\u542F\u52A8\u77E5\u8BC6\u56FE\u8C31\u7D22\u5F15\u5E76\u7ACB\u5373\u8FD4\u56DE\uFF08\u5206\u5757 \u2192 LLM \u5B9E\u4F53\u5173\u7CFB\u62BD\u53D6 \u2192 \u793E\u533A\u6458\u8981\uFF1B\u589E\u91CF\u6267\u884C\uFF0C\u4EC5\u5904\u7406\u53D8\u66F4\u6587\u4EF6\uFF09\u3002\u4E0D\u7B49\u5F85\u5B8C\u6210\u2014\u2014\u8FDB\u5EA6\u7528 graphrag_status \u8F6E\u8BE2\u6216\u8BF7\u7528\u6237\u770B\u9762\u677F\u3002\u89E6\u53D1 LLM \u8C03\u7528\u6210\u672C\uFF0C\u9700\u7528\u6237\u5BA1\u6279\u3002",
    parameters: {
      type: "object",
      properties: {
        kb: { type: "string", description: "\u53EF\u9009\uFF1A\u77E5\u8BC6\u5E93\u540D\uFF1B\u7F3A\u7701\u6309\u5DE5\u4F5C\u533A\u81EA\u52A8\u5339\u914D\uFF08\u591A\u5E93\u65F6\u5FC5\u987B\u6307\u5B9A\uFF09" },
        create: { type: "boolean", description: "kb \u4E0D\u5B58\u5728\u65F6\u65B0\u5EFA\u8BE5\u77E5\u8BC6\u5E93\uFF08\u9700\u540C\u65F6\u7ED9 roots\uFF09\uFF0C\u7F3A\u7701 false" },
        roots: { type: "array", items: { type: "string" }, description: "create=true \u65F6\u4E3A\u65B0\u5EFA\u5E93\u7684\u6388\u6743\u76EE\u5F55\uFF1B\u5426\u5219\u4E3A\u672C\u6B21\u7D22\u5F15\u7684\u5DF2\u6388\u6743\u5B50\u8DEF\u5F84" },
        retryQuarantined: { type: "boolean", description: "\u540C\u65F6\u91CD\u653E\u9694\u79BB\u533A\uFF0C\u7F3A\u7701 false" }
      }
    },
    output: { schema: outputObject.schema, render: jsonRender },
    execute: async (args, exec) => {
      const caller = callerFrom(exec);
      try {
        const cwd = requireCallerCwd(caller);
        const a = args ?? {};
        const roots = Array.isArray(a["roots"]) ? a["roots"].filter((r) => typeof r === "string") : void 0;
        const opts = {
          roots,
          retryQuarantined: a["retryQuarantined"] === true
        };
        const kbName = typeof a["kb"] === "string" && a["kb"].trim() !== "" ? a["kb"].trim() : void 0;
        if (kbName !== void 0 && a["create"] === true && resolve().listKbs().every((k) => k.name !== kbName)) {
          if (roots === void 0 || roots.length === 0) {
            throw new ToolRejection("invalid", `\u65B0\u5EFA\u77E5\u8BC6\u5E93\u300C${kbName}\u300D\u9700\u8981\u63D0\u4F9B roots\uFF08\u6388\u6743\u76EE\u5F55\uFF09`);
          }
          resolve().createKb({ name: kbName, roots, description: "\u7531 graphrag_index create \u521B\u5EFA" });
        }
        const started = resolve().indexBackground(kbRefOf(a) ?? {}, opts, caller.sessionId);
        return {
          ok: true,
          value: started.started ? { started: true, kb: kbName ?? null, note: "\u7D22\u5F15\u5DF2\u5728\u540E\u53F0\u542F\u52A8\uFF1B\u7528 graphrag_status \u8F6E\u8BE2\u8FDB\u5EA6\uFF08phase/filesTotal/lastIndexedAt\uFF09\uFF0C\u5B8C\u6210\u540E graphrag_query \u53EF\u68C0\u7D22" } : { started: false, note: "\u8BE5\u77E5\u8BC6\u5E93\u5DF2\u6709\u7D22\u5F15\u5728\u540E\u53F0\u8FD0\u884C\uFF1B\u7528 graphrag_status \u67E5\u770B\u8FDB\u5EA6" }
        };
      } catch (error) {
        return toolEnvelope(error);
      }
    }
  };
  const forgetDef = {
    name: "graphrag_forget",
    description: "\u4ECE\u77E5\u8BC6\u56FE\u8C31\u79FB\u9664\u6570\u636E\uFF1A\u6307\u5B9A\u6587\u4EF6\u3001\u6307\u5B9A\u5B9E\u4F53\u3001\u6216\u6574\u56FE\u91CD\u7F6E\u3002\u9500\u6BC1\u6027\u64CD\u4F5C\uFF0C\u7EA7\u8054\u5220\u9664\u5173\u8054 chunk/\u5173\u7CFB/\u6458\u8981\uFF0C\u9700\u7528\u6237\u5BA1\u6279\u3002",
    parameters: {
      type: "object",
      properties: {
        kb: { type: "string", description: "\u53EF\u9009\uFF1A\u77E5\u8BC6\u5E93\u540D\uFF1B\u7F3A\u7701\u6309\u5DE5\u4F5C\u533A\u81EA\u52A8\u5339\u914D\uFF08\u591A\u5E93\u65F6\u5FC5\u987B\u6307\u5B9A\uFF09" },
        target: {
          oneOf: [
            { type: "object", properties: { kind: { const: "file" }, path: { type: "string" } }, required: ["kind", "path"] },
            { type: "object", properties: { kind: { const: "entity" }, name: { type: "string" } }, required: ["kind", "name"] },
            { type: "object", properties: { kind: { const: "graph" } }, required: ["kind"] }
          ],
          description: "\u9057\u5FD8\u76EE\u6807\uFF1Afile\uFF08\u6309\u8DEF\u5F84\uFF09/ entity\uFF08\u6309\u540D\uFF09/ graph\uFF08\u6E05\u7A7A\u8BE5\u5E93\u56FE\u8C31\uFF09"
        }
      },
      required: ["target"]
    },
    output: { schema: outputObject.schema, render: jsonRender },
    timeoutMs: 6e4,
    execute: async (args, exec) => {
      const caller = callerFrom(exec);
      try {
        const cwd = requireCallerCwd(caller);
        const a = args;
        const target = validateForgetTarget(a["target"]);
        const report = await resolve().forget(kbRefOf(a), target, cwd);
        return { ok: true, value: report };
      } catch (error) {
        return toolEnvelope(error);
      }
    }
  };
  return [queryDef, graphDef, statusDef, indexDef, forgetDef];
}
function validateForgetTarget(raw) {
  const t = raw;
  if (t === null || typeof t !== "object") throw new ToolRejection("invalid", "target \u5FC5\u987B\u662F\u5BF9\u8C61");
  if (t["kind"] === "file" && typeof t["path"] === "string" && t["path"] !== "") return { kind: "file", path: t["path"] };
  if (t["kind"] === "entity" && typeof t["name"] === "string" && t["name"] !== "") return { kind: "entity", name: t["name"] };
  if (t["kind"] === "graph") return { kind: "graph" };
  throw new ToolRejection("invalid", 'target \u5F62\u72B6\u4E0D\u5408\u6CD5\uFF1A{kind:"file",path} | {kind:"entity",name} | {kind:"graph"}');
}
var MUTATING_TOOLS = /* @__PURE__ */ new Set(["graphrag_index", "graphrag_forget"]);
function approvalDecision(exec, mounted, estimate) {
  if (!mounted || exec.signal.aborted || !MUTATING_TOOLS.has(exec.name)) return void 0;
  const caller = callerFrom(exec);
  if (exec.name === "graphrag_index") {
    const a = exec.arguments ?? {};
    const opts = {
      roots: Array.isArray(a["roots"]) ? a["roots"].filter((r) => typeof r === "string") : void 0
    };
    let detail = "";
    if (estimate !== void 0 && caller.cwd !== void 0) {
      try {
        const a2 = exec.arguments ?? {};
        const est = estimate(kbRefOf(a2), opts, caller.cwd);
        detail = est.files > 0 ? `\uFF08\u7EA6 ${est.estCalls} \u6B21 LLM \u8C03\u7528\uFF0C\u6D89\u53CA ${est.files} \u4E2A\u6587\u4EF6\uFF09` : "\uFF08\u5F53\u524D\u65E0\u53D8\u66F4\u6587\u4EF6\uFF0C\u9884\u8BA1\u96F6 LLM \u8C03\u7528\uFF09";
      } catch {
      }
    }
    const en = `Run a GraphRAG index: chunk authorized files, extract entities/relations via LLM, rebuild communities. ${detail || "LLM cost applies."}`;
    return {
      kind: "ask",
      reason: `graphrag_index: incremental knowledge-graph indexing. ${detail || "LLM cost applies."}`,
      displayReason: {
        en,
        zh: `\u5373\u5C06\u6267\u884C\u56FE\u8C31\u7D22\u5F15\uFF1A\u5206\u5757\u2192LLM \u62BD\u53D6\u2192\u793E\u533A\u6458\u8981\uFF08\u589E\u91CF\uFF0C\u4EC5\u5904\u7406\u53D8\u66F4\uFF09\u3002${detail}\u7EE7\u7EED\uFF1F`
      }
    };
  }
  const t = exec.arguments?.["target"];
  const kind = typeof t?.["kind"] === "string" ? t["kind"] : "data";
  const what = kind === "file" ? `file ${String(t?.["path"] ?? "")}` : kind === "entity" ? `entity ${String(t?.["name"] ?? "")}` : kind === "graph" ? "the ENTIRE graph for this workspace" : "the requested data";
  return {
    kind: "ask",
    reason: `graphrag_forget: destroy ${what} (cascading).`,
    displayReason: {
      en: `This removes ${what} from the knowledge graph, cascading to related chunks/relations/summaries.`,
      zh: `\u5373\u5C06\u4ECE\u56FE\u8C31\u79FB\u9664 ${what === "the ENTIRE graph for this workspace" ? "\u6574\u4E2A\u5DE5\u4F5C\u533A\u56FE\u8C31" : what}\uFF0C\u7EA7\u8054\u5220\u9664\u5173\u8054\u6570\u636E\u3002\u7EE7\u7EED\uFF1F`
    }
  };
}
var ANNOUNCEMENT = `\u672C\u5DE5\u4F5C\u533A\u5DF2\u542F\u7528 dsh-kylin-vibe \u63D2\u4EF6\uFF08\u77E5\u8BC6\u56FE\u8C31\u68C0\u7D22\uFF09\uFF1A\u628A\u6388\u6743\u8BED\u6599\u7D22\u5F15\u6210\u5B9E\u4F53-\u5173\u7CFB-\u793E\u533A\u56FE\u8C31\uFF0C\u4F9B\u4EFB\u52A1\u63A8\u7406\u65F6\u505A\u7ED3\u6784\u5316\u68C0\u7D22\u3002\u5DE5\u5177\uFF1Agraphrag_query\uFF08local=\u5173\u7CFB\u6027\u95EE\u9898 / global=\u5168\u5C40\u67B6\u6784\u95EE\u9898\uFF09\u3001graphrag_graph\uFF08\u591A\u8DF3\u904D\u5386\uFF0C\u5F71\u54CD\u9762\u5206\u6790 direction=in\uFF09\u3001graphrag_status\uFF08\u8986\u76D6\u4E0E\u65B0\u9C9C\u5EA6\uFF09\u3001graphrag_index\uFF08\u5EFA\u56FE/\u589E\u91CF\u66F4\u65B0\uFF0C\u9700\u5BA1\u6279\uFF09\u3001graphrag_forget\uFF08\u9057\u5FD8\uFF0C\u9700\u5BA1\u6279\uFF09\u3002\u4E09\u4E2A\u975E\u663E\u7136\u7EA6\u675F\uFF1A\u2460 \u5F15\u7528\u7ED3\u8BBA\u5FC5\u987B\u843D\u5230\u8FD4\u56DE chunks \u7684\u539F\u6587\u4F4D\u7F6E\uFF08path+lines\uFF09\uFF0Ccommunities \u6458\u8981\u662F LLM \u4E8C\u624B\u4FE1\u606F\u4EC5\u4F9B\u53C2\u8003\uFF1B\u2461 graphrag_status \u663E\u793A\u9648\u65E7\u5EA6\u9AD8\u65F6\u5148 graphrag_index \u589E\u91CF\u66F4\u65B0\u518D\u68C0\u7D22\uFF1B\u2462 \u7CBE\u786E\u6587\u672C\u67E5\u627E\u4ECD\u4F18\u5148 grep/glob\uFF0C\u56FE\u8C31\u89E3\u51B3\u7684\u662F"\u5173\u8054/\u5168\u5C40"\u7C7B\u95EE\u9898\u3002`;
var name = "dsh-kylin-vibe/tool";
var inject = ["graphrag", "tools", "systemPrompt", "agents"];
function apply(ctx, config = {}) {
  const mounted = ctx;
  const service = mounted.graphrag;
  if (service === void 0) {
    ctx.logger?.warn("dsh-kylin-vibe/tool: seam \u672A\u6302\u8F7D\uFF0C\u5DE5\u5177\u9762\u672A\u5B89\u88C5");
    return;
  }
  const services = { resolve: (pin) => service.resolve(pin ?? config.providerPin) };
  const defs = graphragToolDefs(services, config);
  const agentTools = /* @__PURE__ */ new Map();
  const owned = [];
  owned.push(ctx.systemPrompt.section({ name: `plugin:${name}`, order: 210, text: ANNOUNCEMENT }));
  const mountTools = (agent) => {
    const scoped = agent;
    const agentId = typeof scoped?.id === "string" ? scoped.id : void 0;
    const sessionId = typeof scoped?.session?.id === "string" ? scoped.session.id : void 0;
    if (agentId === void 0 || sessionId === void 0 || scoped.ctx === void 0) return;
    if (!ctx.agents.roots().some((root) => root.id === agentId)) return;
    if (agentTools.has(sessionId)) return;
    const registered = scoped.ctx.effect(() => {
      const removers = defs.map((def) => scoped.ctx.tools.register(def));
      return () => {
        for (const remove of [...removers].reverse()) void remove();
      };
    }, "dsh-kylin-vibe: agent tools");
    agentTools.set(sessionId, registered);
  };
  for (const root of ctx.agents.roots()) mountTools(root);
  owned.push(ctx.on("agent/created", (payload) => {
    mountTools(payload?.agent ?? payload);
  }));
  owned.push(ctx.on("agent/disposed", (payload) => {
    const agent = payload?.agent ?? payload;
    const sessionId = agent?.session?.id;
    if (typeof sessionId === "string") agentTools.delete(sessionId);
  }));
  const estimateOf = () => {
    try {
      const provider = service.resolve(config.providerPin);
      return provider.estimate?.bind(provider);
    } catch {
      return void 0;
    }
  };
  owned.push(ctx.on("tools/pre-execute", async (exec, next) => {
    const downstream = await next?.();
    if (downstream === void 0) return { kind: "allow" };
    if (downstream.kind !== "allow") return downstream;
    const caller = callerFrom(exec);
    const isMounted = caller.sessionId !== void 0 && agentTools.has(caller.sessionId);
    const decision = approvalDecision(
      exec,
      isMounted,
      estimateOf()
    );
    return decision ?? downstream;
  }));
  ctx.effect(() => {
    return async () => {
      for (const dispose of [...agentTools.values()].reverse()) {
        try {
          dispose();
        } catch (error) {
          ctx.logger?.warn(`dsh-kylin-vibe: tool teardown failed: ${String(error)}`);
        }
      }
      agentTools.clear();
      for (const dispose of [...owned].reverse()) {
        try {
          dispose();
        } catch (error) {
          ctx.logger?.warn(`dsh-kylin-vibe: teardown failed: ${String(error)}`);
        }
      }
    };
  }, "dsh-kylin-vibe: tool consumer lifecycle");
}
export {
  ANNOUNCEMENT,
  MUTATING_TOOLS,
  apply,
  approvalDecision,
  graphragToolDefs,
  inject,
  name,
  renderEvidencePack
};
//# sourceMappingURL=tool.js.map
