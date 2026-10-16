/* Verified Android executor. */
(function (root) {
  "use strict";

  const guardApi = typeof module !== "undefined" && module.exports
    ? require("./android-agent-executor-guards.js") : root.MosharrofAndroidAgentExecutorGuards;
  const recoveryHandler = options => options.recoveryHandler ||
    (typeof module !== "undefined" && module.exports
      ? require("./android-agent-executor-recovery.js") : root.MosharrofAndroidAgentExecutorRecovery);

  function createExecutor(options = {}) {
    const adapter = options.adapter;
    const verify = options.verify;
    const isCapabilityReady = options.isCapabilityReady || (() => false);
    const confirm = options.confirm || (async () => false);
    const onProgress = options.onProgress || (() => {});
    const recoveryApi = options.recovery || root.MosharrofAgentRecovery;
    const getRecoveryAttempts = options.getRecoveryAttempts;
    const isSafeToRetry = options.isSafeToRetry || (() => false);
    const maxSteps = Number.isInteger(options.maxSteps) ? Math.max(1, Math.min(options.maxSteps, 50)) : 20;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(250, Math.min(options.timeoutMs, 120000)) : 15000;
    let cancelled = false;

    function cancel() { cancelled = true; }

    async function withTimeout(promise, label) {
      let timer;
      try {
        return await Promise.race([
          Promise.resolve().then(() => promise),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(label + " timeout")), timeoutMs);
          })
        ]);
      } finally {
        clearTimeout(timer);
      }
    }

    async function run(plan) {
      cancelled = false;
      const rejected = guardApi.validatePlan(plan, maxSteps, adapter, verify);
      if (rejected) return rejected;

      const results = [];
      for (let i = 0; i < plan.steps.length; i += 1) {
        const step = plan.steps[i];
        if (cancelled) {
          results.push({ index: i, action: step.action, status: "cancelled" });
          return { status: "cancelled", reason: "ব্যবহারকারী কাজ থামিয়েছেন।", steps: results };
        }
        if (!step || typeof step.action !== "string" || !step.action || !step.capability ||
            !isCapabilityReady(step.capability, step)) {
          results.push({ index: i, action: step && step.action, status: "blocked", reason: "সক্ষমতা বাস্তবে প্রস্তুত নয়।" });
          return { status: "blocked", reason: "প্রয়োজনীয় native capability প্রস্তুত নয়; পরবর্তী ধাপ বন্ধ।", steps: results };
        }
        if (step.requiresConfirmation && !(await confirm(step))) {
          results.push({ index: i, action: step.action, status: "cancelled", reason: "ব্যবহারকারীর নিশ্চিতকরণ পাওয়া যায়নি।" });
          return { status: "cancelled", reason: "নিশ্চিতকরণ ছাড়া কাজ চালানো হয়নি।", steps: results };
        }
        try {
          onProgress({ index: i, total: plan.steps.length, action: step.action, status: "running" });
          const execution = await withTimeout(adapter.execute(step), "execution");
          if (!execution || execution.ok !== true) throw new Error((execution && execution.reason) || "native action failed");
          const verified = await withTimeout(verify(step, execution), "verification");
          if (!verified || verified.ok !== true) throw new Error((verified && verified.reason) || "postcondition not verified");
          results.push({ index: i, action: step.action, status: "verified", evidence: verified.evidence || null });
          onProgress({ index: i, total: plan.steps.length, action: step.action, status: "verified" });
        } catch (error) {
          const failureReason = String(error && error.message || error).slice(0, 240);
          const recovery = recoveryHandler(options);
          const recovered = recovery && typeof recovery.recoverStep === "function"
            ? await recovery.recoverStep({
              recoveryApi, getRecoveryAttempts, isSafeToRetry, step, error,
              isCancelled: () => cancelled, isCapabilityReady, confirm, adapter, verify, withTimeout, onProgress
            }) : null;
          if (recovered && recovered.status === "recovered") {
            const last = recovered.attempts[recovered.attempts.length - 1];
            results.push({ index: i, action: step.action, status: "recovered",
              recovery: recovered, evidence: last && last.evidence || null });
            onProgress({ index: i, total: plan.steps.length, action: step.action, status: "recovered" });
            continue;
          }
          if (cancelled) {
            results.push({ index: i, action: step.action, status: "cancelled" });
            return { status: "cancelled", reason: "ব্যবহারকারী recovery চলাকালে কাজ থামিয়েছেন।", steps: results };
          }
          results.push({ index: i, action: step.action, status: "failed", reason: failureReason,
            recovery: recovered && recovered.attempts ? recovered : undefined });
          return { status: "failed", reason: "একটি ধাপ ব্যর্থ বা যাচাইহীন; নিরাপদে পরবর্তী ধাপ বন্ধ করা হয়েছে।", steps: results };
        }
      }
      return { status: "completed", reason: "সব ধাপের postcondition যাচাই হয়েছে।", steps: results };
    }

    return Object.freeze({ run, cancel });
  }

  const api = Object.freeze({ createExecutor });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidAgentExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
