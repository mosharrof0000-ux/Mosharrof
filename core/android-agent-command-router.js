/* Allowlisted command router for MOSHARROF's mediated Android settings actions.
 * Unknown commands remain in chat; no arbitrary selectors or generated code are executed.
 */
(function (root) {
  "use strict";
  const ACTION_METHODS = Object.freeze({
    open_wifi_settings: "openWifiSettings",
    open_bluetooth_settings: "openBluetoothSettings",
    open_display_settings: "openDisplaySettings",
    open_accessibility_settings: "openAccessibilitySettings",
    open_app_settings: "openAppSettings"
  });

  function createCommandRouter(options = {}) {
    const planner = options.planner || root.MosharrofAndroidAgentPlanner;
    const executorApi = options.executor || root.MosharrofAndroidAgentExecutor;
    const getPlugin = options.getPlugin || (() => {
      const plugins = root.Capacitor && root.Capacitor.Plugins;
      return plugins && plugins.DeviceControl;
    });
    const confirm = options.confirm || ((message) => root.confirm(message));
    const report = options.report || ((message) => {
      const toast = root.document && root.document.getElementById("toast");
      if (toast) {
        toast.textContent = message;
        toast.classList.add("show");
        root.setTimeout(() => toast.classList.remove("show"), 3600);
      }
    });

    const fileRouterApi = options.fileTaskRouter || root.MosharrofAndroidFileCommandRouter;
    const fileRouter = fileRouterApi && typeof fileRouterApi.createFileCommandRouter === "function"
      ? fileRouterApi.createFileCommandRouter({
        taskPlanner: options.taskPlanner || root.MosharrofAndroidTaskPlanner, confirm, report
      }) : null;

    function handle(command) {
      if (planner && typeof planner.planCommand === "function" &&
          executorApi && typeof executorApi.createExecutor === "function") {
        const plan = planner.planCommand(command);
        if (plan.status === "preview" && plan.steps.length &&
            plan.steps.every(step => Object.prototype.hasOwnProperty.call(ACTION_METHODS, step.action))) {
          return { handled: true, promise: executePlan(plan) };
        }
      }
      return fileRouter ? fileRouter.handle(command) : { handled: false };
    }

    async function executePlan(plan) {
      const summary = plan.steps.map((step, index) =>
        (index + 1) + ". " + step.title + (step.reason ? " — " + step.reason : "")).join("\n");
      if (!confirm("MOSHARROF AI এই কাজের preview তৈরি করেছে:\n" + summary +
          "\n\nশুধু Android সেটিংস খোলা হবে; কোনো সেটিংস নিজে থেকে বদলানো হবে না। চালাব?")) {
        return { status: "cancelled", reason: "ব্যবহারকারী preview বাতিল করেছেন।", steps: [] };
      }
      const plugin = getPlugin();
      const runner = executorApi.createExecutor({
        adapter: {
          execute: async step => {
            const method = ACTION_METHODS[step.action];
            if (!plugin || !method || typeof plugin[method] !== "function") {
              return { ok: false, reason: "এই Android action-এর native bridge নেই।" };
            }
            const response = await plugin[method]();
            return { ok: !!(response && response.opened === true), response };
          }
        },
        verify: async (step, execution) => ({
          ok: !!(execution && execution.ok && execution.response && execution.response.opened === true),
          evidence: "Android Settings intent opened; setting change not verified"
        }),
        isCapabilityReady: (capability, step) => {
          const method = ACTION_METHODS[step && step.action];
          return !!(plugin && method && typeof plugin[method] === "function");
        },
        confirm: async () => true,
        onProgress: event => report(event.status === "verified"
          ? "Android সেটিংস খোলার ধাপ চালু হয়েছে; পরিবর্তন নিজে নিশ্চিত করুন।"
          : "Android নির্দেশ চলছে: " + event.action)
      });
      const result = await runner.run(plan);
      report(result.status === "completed"
        ? "নির্দেশের সব সমর্থিত ধাপ চালু হয়েছে। সেটিংস পরিবর্তন নিজে যাচাই করুন।"
        : (result.reason || "নির্দেশ সম্পন্ন হয়নি।"));
      return result;
    }

    return Object.freeze({ handle });
  }

  const api = Object.freeze({ createCommandRouter });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidAgentCommandRouter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
