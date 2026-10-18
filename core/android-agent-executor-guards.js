/* Pure preflight guards for Android agent execution. */
(function (root) {
  "use strict";
  function validatePlan(plan, maxSteps, adapter, verify) {
    if (!plan || plan.status !== "preview" || !Array.isArray(plan.steps) || !plan.steps.length)
      return { status: "rejected", reason: "শুধু যাচাইযোগ্য preview plan চালানো যায়।", steps: [] };
    if (plan.steps.length > maxSteps)
      return { status: "rejected", reason: "নিরাপত্তার জন্য পরিকল্পনায় অতিরিক্ত ধাপ আছে।", steps: [] };
    if (!adapter || typeof adapter.execute !== "function" || typeof verify !== "function")
      return { status: "unavailable", reason: "Native executor ও postcondition verifier সংযুক্ত নেই; কোনো কাজ চালানো হয়নি।", steps: [] };
    return null;
  }
  const api = Object.freeze({ validatePlan });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidAgentExecutorGuards = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
