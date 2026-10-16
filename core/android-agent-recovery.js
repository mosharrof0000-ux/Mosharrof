/* Bounded recovery for MOSHARROF Android agent.
 * This retries only explicitly supplied, policy-approved alternatives.
 * It never edits code, invents selectors, or broadens permissions on its own.
 */
(function (root) {
  "use strict";
  async function runWithRecovery(options = {}) {
    const attempts = Array.isArray(options.attempts) ? options.attempts.slice(0, 3) : [];
    const execute = options.execute;
    const verify = options.verify;
    const isSafeToRetry = options.isSafeToRetry || (() => false);
    const onProgress = options.onProgress || (() => {});
    if (!attempts.length || typeof execute !== "function" || typeof verify !== "function") {
      return { status: "unavailable", attempts: [], reason: "যাচাইকৃত recovery adapter বা বিকল্প নেই।" };
    }
    const history = [];
    for (let i = 0; i < attempts.length; i += 1) {
      const candidate = attempts[i];
      if (!candidate || typeof candidate.id !== "string" || typeof candidate.action !== "string") {
        history.push({ index: i, status: "blocked", reason: "বিকল্প action-এর schema বৈধ নয়।" });
        break;
      }
      if (i > 0 && !isSafeToRetry(candidate, history[history.length - 1])) {
        history.push({ index: i, id: candidate.id, status: "blocked", reason: "নিরাপদ retry অনুমোদিত নয়।" });
        break;
      }
      try {
        onProgress({ index: i, total: attempts.length, id: candidate.id, status: "running" });
        const result = await execute(candidate);
        if (!result || result.ok !== true) throw new Error(String(result && result.reason || "action failed"));
        const check = await verify(candidate, result);
        if (!check || check.ok !== true) throw new Error(String(check && check.reason || "postcondition mismatch"));
        history.push({ index: i, id: candidate.id, status: "verified", evidence: check.evidence || null });
        return { status: "recovered", selected: candidate.id, attempts: history,
          reason: "বিকল্প action-এর ফলাফল যাচাই হয়েছে।" };
      } catch (error) {
        history.push({ index: i, id: candidate.id, status: "failed",
          reason: String(error && error.message || error).slice(0, 240) });
        onProgress({ index: i, total: attempts.length, id: candidate.id, status: "failed" });
      }
    }
    return { status: "failed", attempts: history,
      reason: "সীমিত বিকল্পগুলো ব্যর্থ বা নিরাপদ retry অনুমোদিত নয়; স্বয়ংক্রিয়ভাবে থেমে গেছে।" };
  }
  const api = Object.freeze({ runWithRecovery });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAgentRecovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
