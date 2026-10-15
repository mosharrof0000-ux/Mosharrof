export function createScopedOrganApi({ id, memory, register, invoke, reportSuccess, reportIssue, health, auditLog }) {
  function args(args, count) {
    if (args.length === count) return args;
    if (args.length === count + 1 && args[0] === id) return args.slice(1);
    throw new Error("organ scope violation: " + id);
  }
  const scopedMemory = Object.freeze({
    get(...a) { const [key] = args(a, 1); return memory.get(id, key); },
    set(...a) { const [key, value] = args(a, 2); return memory.set(id, key, value); },
    delete(...a) { const [key] = args(a, 1); return memory.delete(id, key); },
    clear(...a) { args(a, 0); return memory.clear(id); },
    keys(...a) { args(a, 0); return memory.keys(id); },
    remember(...a) { const [key, value] = args(a, 2); return memory.remember(id, key, value); },
    recall(...a) { const [key] = args(a, 1); return memory.recall(id, key); },
    forget(...a) { const [key] = args(a, 1); return memory.forget(id, key); },
    forgetAll(...a) { args(a, 0); return memory.forgetAll(id); },
    persistentKeys(...a) { args(a, 0); return memory.persistentKeys(id); }
  });
  function scopedSummary(args) {
    if (args.length === 1) return args[0];
    if (args.length === 2 && args[0] === id) return args[1];
    throw new Error("organ scope violation: " + id);
  }
  return Object.freeze({
    id, memory: scopedMemory, register, invoke,
    reportSuccess(...a) { return reportSuccess(scopedSummary(a)); },
    reportIssue(...a) { return reportIssue(scopedSummary(a)); },
    health(requestedId) { if (requestedId !== undefined && requestedId !== id) throw new Error("organ scope violation: " + id); return health(); },
    auditLog(requestedId) { if (requestedId !== undefined && requestedId !== id) throw new Error("organ scope violation: " + id); return auditLog(); }
  });
}
