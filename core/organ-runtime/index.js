/**
 * Capability-gated runtime services for independent Mosharrof organs.
 * State is namespaced per organ; cross-organ access requires a declared link.
 * Optional browser-local storage is for non-secret, user-approved notes only; no network or credentials.
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
function safeSummary(value) {
  return String(value).slice(0, 240).replace(/(api[-_ ]?key|token|password|secret|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

export function createOrganRuntime({ registry, linkManager, limits = {}, storage = null } = {}) {
  if (!registry || typeof registry.get !== "function" || typeof registry.has !== "function" || typeof registry.list !== "function") {
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
  const STORAGE_PREFIX = "mosharrof:organ-memory:v1:";

  function requireStorage() {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
      throw new Error("persistent organ memory is unavailable in this environment");
    }
    return storage;
  }
  function persistentKeys(id) {
    if (!storage || typeof storage.key !== "function" || !Number.isInteger(storage.length)) return [];
    const prefix = STORAGE_PREFIX + id + ":";
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const full = storage.key(i);
      if (typeof full === "string" && full.startsWith(prefix)) keys.push(full.slice(prefix.length));
    }
    return keys;
  }
  function persistentKey(id, key) { return STORAGE_PREFIX + id + ":" + key; }

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
    forOrgan(id) {
      requireOrgan(id);
      const runtime = this;
      const scopedMemory = Object.freeze({
        get: (key) => runtime.memory.get(id, key),
        set: (key, value) => runtime.memory.set(id, key, value),
        delete: (key) => runtime.memory.delete(id, key),
        clear: () => runtime.memory.clear(id),
        keys: () => runtime.memory.keys(id),
        remember: (key, value) => runtime.memory.remember(id, key, value),
        recall: (key) => runtime.memory.recall(id, key),
        forget: (key) => runtime.memory.forget(id, key),
        forgetAll: () => runtime.memory.forgetAll(id),
        persistentKeys: () => runtime.memory.persistentKeys(id)
      });
      return Object.freeze({
        id, memory: scopedMemory,
        register: (organHandlers) => runtime.register(id, organHandlers),
        invoke: (targetId, api, payload = {}) => runtime.invoke(id, targetId, api, payload),
        reportSuccess: (summary) => runtime.reportSuccess(id, summary),
        reportIssue: (summary) => runtime.reportIssue(id, summary),
        health: () => runtime.health(id),
        auditLog: () => runtime.auditLog(id)
      });
    },
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
        store.set(safe, cloneJson(value, "stored value", config.maxValueBytes));
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
      keys(id) { requireOrgan(id); return [...memory.get(id).keys()]; },
      remember(id, key, value) {
        requireOrgan(id);
        const store = requireStorage();
        const safe = safeKey(key);
        const full = persistentKey(id, safe);
        if (store.getItem(full) === null && persistentKeys(id).length >= config.maxMemoryEntries) {
          throw new RangeError("persistent organ memory entry limit reached");
        }
        const copy = cloneJson(value, "stored value", config.maxValueBytes);
        store.setItem(full, JSON.stringify(copy));
        record(id, "success", { action: "memory.remember", key: safe });
        return true;
      },
      recall(id, key) {
        requireOrgan(id);
        const store = requireStorage();
        const safe = safeKey(key);
        const raw = store.getItem(persistentKey(id, safe));
        if (raw === null) return null;
        try { return cloneJson(JSON.parse(raw), "stored value", config.maxValueBytes); }
        catch {
          store.removeItem(persistentKey(id, safe));
          record(id, "issue", { action: "memory.recall", key: safe, error: "InvalidStoredValue" });
          return null;
        }
      },
      forget(id, key) {
        requireOrgan(id);
        const store = requireStorage();
        const safe = safeKey(key);
        const full = persistentKey(id, safe);
        const existed = store.getItem(full) !== null;
        store.removeItem(full);
        if (existed) record(id, "success", { action: "memory.forget", key: safe });
        return existed;
      },
      forgetAll(id) {
        requireOrgan(id);
        const store = requireStorage();
        const keys = persistentKeys(id);
        for (const key of keys) store.removeItem(persistentKey(id, key));
        record(id, "success", { action: "memory.forgetAll", count: keys.length });
        return keys.length;
      },
      persistentKeys(id) { requireOrgan(id); return persistentKeys(id); }
    }),
    async invoke(sourceId, targetId, api, payload = {}) {
      requireOrgan(sourceId);
      requireOrgan(targetId);
      linkManager.connect(sourceId, targetId, api);
      const handler = handlers.get(targetId)?.get(api);
      if (typeof handler !== "function") throw new Error("target API is not registered: " + targetId + ":" + api);
      const safePayload = validatePayload(payload);
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
        return Object.freeze({ organId: id, ...health.get(id), memoryEntries: memory.get(id).size, persistentMemoryEntries: persistentKeys(id).length, registeredApis: [...(handlers.get(id)?.keys() ?? [])] });
      }
      return [...registry.list()].map(({ id: organId }) => this.health(organId));
    },
    auditLog(id) { return audit.filter((entry) => id === undefined || entry.organId === id).map((entry) => ({ ...entry })); },
    policy: Object.freeze({
      persistence: storage ? "browser-local-storage" : "memory-only",
      persistenceScope: storage ? "this-browser-origin" : "session",
      crossOrganAccess: "declared-link-and-public-api-only",
      secretStorage: "forbidden",
      networkAccess: "not-provided",
      liveMutation: "not-provided",
      defaultLimits: DEFAULTS
    })
  });
}
