export function createScopedOrganApi({ id, memory, register, invoke, reportSuccess, reportIssue, health, auditLog }) {
  const scopedMemory = Object.freeze({
    get: (key) => memory.get(id, key), set: (key, value) => memory.set(id, key, value),
    delete: (key) => memory.delete(id, key), clear: () => memory.clear(id), keys: () => memory.keys(id),
    remember: (key, value) => memory.remember(id, key, value), recall: (key) => memory.recall(id, key),
    forget: (key) => memory.forget(id, key), forgetAll: () => memory.forgetAll(id),
    persistentKeys: () => memory.persistentKeys(id)
  });
  return Object.freeze({ id, memory: scopedMemory, register, invoke, reportSuccess, reportIssue, health, auditLog });
}
