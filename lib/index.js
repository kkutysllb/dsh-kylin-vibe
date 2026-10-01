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

// src/index.ts
var GraphRagServiceImpl = class {
  providers = /* @__PURE__ */ new Map();
  register(provider) {
    if (this.providers.has(provider.id)) {
      throw new GraphRagError("NO_PROVIDER", `provider \u91CD\u590D\u6CE8\u518C\uFF1A${provider.id}`);
    }
    this.providers.set(provider.id, provider);
    return () => {
      this.providers.delete(provider.id);
    };
  }
  resolve(pin) {
    if (pin !== void 0 && pin !== "") {
      const p = this.providers.get(pin);
      if (p === void 0) throw new GraphRagError("NO_PROVIDER", `\u672A\u6CE8\u518C\u7684 provider\uFF1A${pin}`);
      return p;
    }
    if (this.providers.size === 1) return [...this.providers.values()][0];
    if (this.providers.size === 0) {
      throw new GraphRagError("NO_PROVIDER", "\u6CA1\u6709\u5DF2\u6CE8\u518C\u7684 GraphRAG provider");
    }
    const ids = [...this.providers.keys()].join(", ");
    throw new GraphRagError("NO_PROVIDER", `\u591A\u4E2A provider\uFF08${ids}\uFF09\uFF0C\u9700\u5728\u914D\u7F6E\u4E2D\u6307\u5B9A graphrag.provider pin`);
  }
};
var name = "dsh-kylin-vibe";
var inject = [];
function apply(ctx, config = {}) {
  const service = new GraphRagServiceImpl();
  ctx.reflect.provide("graphrag", service);
  void config;
}
export {
  GraphRagServiceImpl,
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
