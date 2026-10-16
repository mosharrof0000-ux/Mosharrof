/* Recovery adapter for the bounded Android executor. */
(function (root) {
  "use strict";
  async function recoverStep(options = {}) {
    const { recoveryApi, getRecoveryAttempts, isSafeToRetry, step, error,
      isCancelled, isCapabilityReady, confirm, adapter, verify, withTimeout, onProgress } = options;
    if (isCancelled() || !recoveryApi || typeof recoveryApi.runWithRecovery !== "function" ||
        typeof getRecoveryAttempts !== "function") return null;
    try {
      const proposed = await withTimeout(getRecoveryAttempts(step, error), "recovery planning");
      const candidates = [];
      for (const candidate of (Array.isArray(proposed) ? proposed : []).slice(0, 3)) {
        if (!candidate || typeof candidate.action !== "string" || !candidate.capability ||
            candidate.action === step.action || !isCapabilityReady(candidate.capability, candidate)) continue;
        const risky = candidate.requiresConfirmation || ["destructive", "sensitive", "high"].includes(candidate.risk);
        if (risky && !(await confirm(candidate))) continue;
        candidates.push(candidate);
      }
      return await recoveryApi.runWithRecovery({
        attempts: candidates,
        execute: async candidate => isCancelled()
          ? { ok: false, reason: "cancelled" }
          : withTimeout(adapter.execute(candidate), "recovery execution"),
        verify: async (candidate, execution) => withTimeout(verify(candidate, execution), "recovery verification"),
        isSafeToRetry: (candidate, previous) => !isCancelled() &&
          isSafeToRetry(candidate, step, error, previous),
        onProgress
      });
    } catch (failure) {
      return { status: "failed", reason: String(failure && failure.message || failure).slice(0, 240) };
    }
  }
  const api = Object.freeze({ recoverStep });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidAgentExecutorRecovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
