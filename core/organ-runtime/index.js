/**
 * Capability-gated runtime services for independent Mosharrof organs.
 * State is namespaced per organ; cross-organ access requires a declared link.
 * This module never persists data, reads secrets, performs network calls, or deploys.
 */
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

export function createOrganRuntime({ registry, linkManager, limits = {} } = {}) {
  if (!registry || typeof registry.get !== "function" || typeof registry.has !== "function") {
    throw new TypeError("a validated organ registry is required");
  }
  if (!linkManager || typeof linkManager.connect !== "function" || typeof linkManager.list !== "function") {
    throw new TypeError("a contract-based link manager is required");
  }
  const config = { ...DEFAULTS, ...limits };
  for (const key of Object.keys(DEFAULTS)) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new RangeError(key + " must be a positive integer");
  }
  const memory = new Map();
  const handlers = new Map();
  const health = new Map();
  const audit = [];

  function requireOrgan(id) {
    safeId(id, "organ id");
    if (!registry.has(id)) throw new Error("unknown organ: " + id);
    if (!memory.has(id)) memory.set(id, new Map());
    if (!health.has(id)) health.set(id, { status: "registered", successes: 0, issues: 0, lastEventAt: null });
    return health.get(id);
  }
  function record(id, type, details = {}) {
    const state = requireOrgan(id);
    const entry = Object.freeze({ organId: id, type, at: new Date().toISOString(), ...details });
    audit.push(entry);
    if (audit.length > config.maxAuditEntries) audit.splice(0, audit.length - config.maxAuditEntries);
    state.lastEventAt = entry.at;
    if (type === "success") { state.successes += 1; state.status = "ready"; }
    if (type === "issue") { state.issues += 1; state.status = "degraded"; }
    return entry;
  }
  function validatePayload(payload) {
    return cloneJson(payload ?? {}, "payload", config.maxPayloadBytes);
  }

  return Object.freeze({
    register(id, organHandlers) {
      const state = requireOrgan(id);
      if (!organHandlers || typeof organHandlers !== "object" || Array.isArray(organHandlers)) {
        throw new TypeError("organ handlers must be an object");
      }
      const manifest = registry.get(id);
      const apiNames = Object.keys(organHandlers);
      for (const api of apiNames) {
        if (!manifest.public_api.includes(api)) throw new Error("handler is not a declared public API: " + id + ":" + api);
        if (typeof organHandlers[api] !== "function") throw new TypeError("handler must be a function: " + api);
      }
      handlers.set(id, new Map(Object.entries(organHandlers)));
      state.status = "ready";
      record(id, "success", { action: "register", count: apiNames.length });
      return Object.freeze({ id, status: "ready", registeredApis: [...apiNames] });
    },
    memory: Object.freeze({
      get(id, key) {
        requireOrgan(id);
        const value = memory.get(id).get(safeKey(key));
        return value === undefined ? null : cloneJson(value, "stored value", config.maxValueBytes);
      },
      set(id, key, value) {
        requireOrgan(id);
        const safe = safeKey(key);
        const store = memory.get(id);
        if (!store.has(safe) && store.size >= config.maxMemoryEntries) throw new RangeError("organ memory entry limit reached");
        const copy = cloneJson(value, "stored value", config.maxValueBytes);
        store.set(safe, copy);
        record(id, "success", { action: "memory.set", key: safe });
        return true;
      },
      delete(id, key) {
        requireOrgan(id);
        const safe = safeKey(key);
        const removed = memory.get(id).delete(safe);
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
      keys(id) { requireOrgan(id); return [...memory.get(id).keys()]; }
    }),
    async invoke(sourceId, targetId, api, payload = {}) {
      requireOrgan(sourceId);
      requireOrgan(targetId);
      // connect() refuses unless source manifest explicitly declares targetId:api.
      linkManager.connect(sourceId, targetId, api);
      const targetHandlers = handlers.get(targetId);
      const handler = targetHandlers?.get(api);
      if (typeof handler !== "function") throw new Error("target API is not registered: " + targetId + ":" + api);
      const safePayload = validatePayload(payload);
      try {
        const result = await handler(safePayload, Object.freeze({ sourceId, targetId, api }));
        const safeResult = cloneJson(result ?? null, "handler result", config.maxPayloadBytes);
        record(targetId, "success", { action: "invoke", api, caller: sourceId });
        return safeResult;
      } catch (error) {
        record(targetId, "issue", { action: "invoke", api, caller: sourceId, error: String(error?.message ?? "handler failed").slice(0, 240) });
        throw error;
      }
    },
    reportSuccess(id, summary = "operation completed") {
      requireOrgan(id);
      const message = String(summary).slice(0, 240);
      return record(id, "success", { action: "report", summary: message });
    },
    reportIssue(id, summary = "operation failed") {
      requireOrgan(id);
      const message = String(summary).slice(0, 240);
      return record(id, "issue", { action: "report", summary: message });
    },
    health(id) {
      if (id !== undefined) {
        requireOrgan(id);
        return Object.freeze({ organId: id, ...health.get(id), memoryEntries: memory.get(id).size, registeredApis: [...(handlers.get(id)?.keys() ?? [])] });
      }
      return [...registry.list()].map(({ id: organId }) => this.health(organId));
    },
    auditLog() { return audit.map((entry) => ({ ...entry })); },
    policy: Object.freeze({
      persistence: "memory-only",
      crossOrganAccess: "declared-link-and-public-api-only",
      secretStorage: "forbidden",
      networkAccess: "not-provided",
      liveMutation: "not-provided",
      defaultLimits: DEFAULTS
    })
  });
}
