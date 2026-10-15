export function createPersistentMemory({ storage, prefix, maxEntries, maxValueBytes, requireOrgan, record, cloneJson, safeKey }) {
  function requireStorage() {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") throw new Error("persistent organ memory is unavailable in this environment");
    return storage;
  }
  function fullKey(id, key) { return prefix + id + ":" + key; }
  function keys(id) {
    if (!storage || typeof storage.key !== "function" || !Number.isInteger(storage.length)) return [];
    const start = prefix + id + ":", result = [];
    for (let i = 0; i < storage.length; i += 1) {
      const item = storage.key(i);
      if (typeof item === "string" && item.startsWith(start)) result.push(item.slice(start.length));
    }
    return result;
  }
  return Object.freeze({
    remember(id, key, value) {
      requireOrgan(id);
      const store = requireStorage(), safe = safeKey(key), full = fullKey(id, safe);
      if (store.getItem(full) === null && keys(id).length >= maxEntries) throw new RangeError("persistent organ memory entry limit reached");
      store.setItem(full, JSON.stringify(cloneJson(value, "stored value", maxValueBytes)));
      record(id, "success", { action: "memory.remember", key: safe });
      return true;
    },
    recall(id, key) {
      requireOrgan(id);
      const store = requireStorage(), safe = safeKey(key), full = fullKey(id, safe), raw = store.getItem(full);
      if (raw === null) return null;
      try { return cloneJson(JSON.parse(raw), "stored value", maxValueBytes); }
      catch {
        store.removeItem(full);
        record(id, "issue", { action: "memory.recall", key: safe, error: "InvalidStoredValue" });
        return null;
      }
    },
    forget(id, key) {
      requireOrgan(id);
      const store = requireStorage(), safe = safeKey(key), full = fullKey(id, safe), existed = store.getItem(full) !== null;
      store.removeItem(full);
      if (existed) record(id, "success", { action: "memory.forget", key: safe });
      return existed;
    },
    forgetAll(id) {
      requireOrgan(id);
      const store = requireStorage(), current = keys(id);
      for (const key of current) store.removeItem(fullKey(id, key));
      record(id, "success", { action: "memory.forgetAll", count: current.length });
      return current.length;
    },
    keys(id) { requireOrgan(id); return keys(id); }
  });
}
