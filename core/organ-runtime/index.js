import { createPersistentMemory } from "./persistent-memory.js";
import { createScopedOrganApi } from "./scoped-api.js";
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECRET_KEY_RE = /(?:secret|token|password|credential|authorization|api[-_]?key|private[-_]?key)/i;
const DEFAULTS = Object.freeze({ maxMemoryEntries: 100, maxValueBytes: 8192, maxPayloadBytes: 8192, maxAuditEntries: 200 });
function cloneJson(value, label, maxBytes) {
  let encoded;
  try { encoded = JSON.stringify(value); } catch { throw new TypeError(label + " must be JSON-serializable"); }
  if (encoded === undefined) throw new TypeError(label + " must be JSON-serializable");
  if (new TextEncoder().encode(encoded).byteLength > maxBytes) throw new RangeError(label + " exceeds the size limit");
  return JSON.parse(encoded);
}
function safeId(value, label) {
  if (typeof value !== "string" || !ID_RE.test(value)) throw new TypeError(label + " must be lowercase kebab-case");
  return value;
}
function safeKey(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{1,80}$/.test(value)) throw new TypeError("memory key must be 1-80 safe characters");
  if (SECRET_KEY_RE.test(value)) throw new Error("secret-like keys cannot be stored in organ memory");
  return value;
}
function safeSummary(value) {
  return String(value).slice(0, 240).replace(/(api[-_ ]?key|token|password|secret|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}
export function createOrganRuntime({ registry, linkManager, limits = {}, storage = null } = {}) {
  if (!registry || typeof registry.get !== "function" || typeof registry.has !== "function" || typeof registry.list !== "function") throw new TypeError("a validated organ registry is required");
  if (!linkManager || typeof linkManager.connect !== "function" || typeof linkManager.list !== "function") throw new TypeError("a contract-based link manager is required");
  const config = { ...DEFAULTS, ...limits };
  for (const key of Object.keys(DEFAULTS)) if (!Number.isInteger(config[key]) || config[key] < 1) throw new RangeError(key + " must be a positive integer");
  const memory = new Map(), handlers = new Map(), health = new Map(), audit = [];
  function requireOrgan(id) {
    safeId(id, "organ id");
    if (!registry.has(id)) throw new Error("unknown organ: " + id);
    if (!memory.has(id)) memory.set(id, new Map());
    if (!health.has(id)) health.set(id, { status: "registered", enabled: true, successes: 0, issues: 0, lastEventAt: null });
    return health.get(id);
  }
  function record(id, type, details = {}) {
    const state = requireOrgan(id), entry = Object.freeze({ organId: id, type, at: new Date().toISOString(), ...details });
    audit.push(entry);
    if (audit.length > config.maxAuditEntries) audit.splice(0, audit.length - config.maxAuditEntries);
    state.lastEventAt = entry.at;
    if (type === "success") { state.successes += 1; state.status = state.enabled ? "ready" : "disabled"; }
    if (type === "issue") { state.issues += 1; state.status = state.enabled ? "degraded" : "disabled"; }
    return entry;
  }
  const persistent = createPersistentMemory({ storage, prefix: "mosharrof:organ-memory:v1:", maxEntries: config.maxMemoryEntries, maxValueBytes: config.maxValueBytes, requireOrgan, record, cloneJson, safeKey });
  const runtime = {
    forOrgan(id) {
      requireOrgan(id);
      return createScopedOrganApi({
        id, memory: runtime.memory,
        register: (organHandlers) => runtime.register(id, organHandlers),
        invoke: (targetId, api, payload = {}) => runtime.invoke(id, targetId, api, payload),
        reportSuccess: (summary) => runtime.reportSuccess(id, summary),
        reportIssue: (summary) => runtime.reportIssue(id, summary),
        health: () => runtime.health(id), auditLog: () => runtime.auditLog(id)
      });
    },
    register(id, organHandlers) {
      const state = requireOrgan(id);
      if (!state.enabled) throw new Error("organ is disabled: " + id);
      if (!organHandlers || typeof organHandlers !== "object" || Array.isArray(organHandlers)) throw new TypeError("organ handlers must be an object");
      const manifest = registry.get(id), names = Object.keys(organHandlers);
      for (const api of names) {
        if (!manifest.public_api.includes(api)) throw new Error("handler is not a declared public API: " + id + ":" + api);
        if (typeof organHandlers[api] !== "function") throw new TypeError("handler must be a function: " + api);
      }
      handlers.set(id, new Map(Object.entries(organHandlers)));
      state.status = "ready";
      record(id, "success", { action: "register", count: names.length });
      return Object.freeze({ id, status: "ready", registeredApis: [...names] });
    },
    memory: Object.freeze({
      get(id, key) {
        requireOrgan(id);
        const value = memory.get(id).get(safeKey(key));
        return value === undefined ? null : cloneJson(value, "stored value", config.maxValueBytes);
      },
      set(id, key, value) {
        requireOrgan(id);
        const safe = safeKey(key), store = memory.get(id);
        if (!store.has(safe) && store.size >= config.maxMemoryEntries) throw new RangeError("organ memory entry limit reached");
        store.set(safe, cloneJson(value, "stored value", config.maxValueBytes));
        record(id, "success", { action: "memory.set", key: safe });
        return true;
      },
      delete(id, key) {
        requireOrgan(id);
        const safe = safeKey(key), removed = memory.get(id).delete(safe);
        if (removed) record(id, "success", { action: "memory.delete", key: safe });
        return removed;
      },
      clear(id) {
        requireOrgan(id);
        const count = memory.get(id).size;
        memory.get(id).clear();
        record(id, "success", { action: "memory.clear", count });
        return count;
      },
      keys(id) { requireOrgan(id); return [...memory.get(id).keys()]; },
      remember: (id, key, value) => persistent.remember(id, key, value),
      recall: (id, key) => persistent.recall(id, key),
      forget: (id, key) => persistent.forget(id, key),
      forgetAll: (id) => persistent.forgetAll(id),
      persistentKeys: (id) => persistent.keys(id)
    }),
    async invoke(sourceId, targetId, api, payload = {}) {
      const sourceState = requireOrgan(sourceId), targetState = requireOrgan(targetId);
      if (!sourceState.enabled) throw new Error("source organ is disabled: " + sourceId);
      if (!targetState.enabled) throw new Error("target organ is disabled: " + targetId);
      linkManager.connect(sourceId, targetId, api);
      const handler = handlers.get(targetId)?.get(api);
      if (typeof handler !== "function") throw new Error("target API is not registered: " + targetId + ":" + api);
      const safePayload = cloneJson(payload ?? {}, "payload", config.maxPayloadBytes);
      try {
        const result = await handler(safePayload, Object.freeze({ sourceId, targetId, api }));
        const safeResult = cloneJson(result ?? null, "handler result", config.maxPayloadBytes);
        record(targetId, "success", { action: "invoke", api, caller: sourceId });
        return safeResult;
      } catch (error) {
        record(targetId, "issue", { action: "invoke", api, caller: sourceId, error: String(error?.name ?? "Error").slice(0, 80) });
        throw error;
      }
    },
    setEnabled(id, enabled) {
      if (typeof enabled !== "boolean") throw new TypeError("enabled must be a boolean");
      const state = requireOrgan(id);
      state.enabled = enabled;
      state.status = enabled ? (handlers.has(id) ? "ready" : "registered") : "disabled";
      record(id, "state", { action: "set-enabled", enabled });
      state.status = enabled ? (handlers.has(id) ? "ready" : "registered") : "disabled";
      return Object.freeze({ organId: id, enabled: state.enabled, status: state.status });
    },
    isEnabled(id) { return requireOrgan(id).enabled; },
    reportSuccess(id, summary = "operation completed") {
      requireOrgan(id);
      return record(id, "success", { action: "report", summary: safeSummary(summary) });
    },
    reportIssue(id, summary = "operation failed") {
      requireOrgan(id);
      return record(id, "issue", { action: "report", summary: safeSummary(summary) });
    },
    health(id) {
      if (id !== undefined) {
        requireOrgan(id);
        return Object.freeze({ organId: id, ...health.get(id), memoryEntries: memory.get(id).size, persistentMemoryEntries: persistent.keys(id).length, registeredApis: [...(handlers.get(id)?.keys() ?? [])] });
      }
      return registry.list().map(({ id: organId }) => runtime.health(organId));
    },
    auditLog(id) { return audit.filter((entry) => id === undefined || entry.organId === id).map((entry) => ({ ...entry })); },
    policy: Object.freeze({ persistence: storage ? "browser-local-storage" : "memory-only", persistenceScope: storage ? "this-browser-origin" : "session", crossOrganAccess: "declared-link-and-public-API-only", secretStorage: "forbidden", networkAccess: "not-provided", liveMutation: "not-provided", defaultLimits: DEFAULTS })
  };
  return Object.freeze(runtime);
}
