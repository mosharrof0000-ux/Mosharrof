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

  function parsePackageCommand(raw) {
    const text = String(raw || "").trim().replace(/[!?.,؛،]+$/u, "").replace(/\s+/g, " ");
    if (!text || text.length > 240) return null;
    const lower = text.toLocaleLowerCase();

    if (/^(install\s+(?:apk|app)|install\s+app\s+from\s+apk|অ্যাপ\s+(?:ইনস্টল|ইন্সটল)\s+করুন|apk\s+(?:ইনস্টল|ইন্সটল)\s+করুন|ইনস্টল\s+করুন|ইন্সটল\s+করুন)$/u.test(lower)) {
      return { kind: "pick-apk" };
    }

    let match = text.match(/^(?:uninstall|remove|uninstall app|remove app|অ্যাপ\s+আনইনস্টল\s+করুন|আনইনস্টল\s+করুন|আনইনস্টল|অ্যাপ\s+সরান)(?:\s+(.+))?$/iu);
    if (match) {
      let target = String(match[1] || "").trim();
      target = target.replace(/^(?:app|the app|অ্যাপ)\s+/u, "").trim();
      if (/^(?:app|the app|অ্যাপ)$/iu.test(target)) target = "";
      return { kind: "uninstall", target };
    }

    match = text.match(/^(?:install|install app|search play store|অ্যাপ\s+(?:ইনস্টল|ইন্সটল)\s+করুন|ইনস্টল\s+করুন|ইন্সটল\s+করুন)\s+(.+)$/iu);
    if (match) {
      const query = String(match[1] || "").trim().replace(/^(?:app|the app|অ্যাপ)\s+/iu, "").trim();
      if (query && !/^(?:apk|from apk)$/iu.test(query)) return { kind: "search-store", query };
    }

    return null;
  }

  function packageRequestId() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === "function") return root.crypto.randomUUID();
    } catch (_) {}
    return "pkg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
  }

  function packageResultMessage(result) {
    const status = String(result && result.status || "UNKNOWN").toUpperCase();
    const verified = !!(result && result.packageStateVerified === true);
    if (status === "SUCCEEDED" && verified) return "PASS — " + (result.action === "UNINSTALL_APP" ? "আনইনস্টল" : "ইনস্টল") + " সম্পন্ন; Android package state যাচাই হয়েছে।";
    if (status === "AWAITING_USER_CONFIRMATION") return "অপেক্ষমাণ — Play Store খোলা হয়েছে; ইনস্টল সফল হয়েছে বলে যাচাই করা হয়নি।";
    if (status === "CANCELLED") return "বাতিল — Android-এর নিশ্চিতকরণ সম্পন্ন হয়নি।";
    if (status === "FAILED") return "ব্যর্থ — " + String(result && result.detail || "কাজটি সম্পন্ন হয়নি।");
    return "যাচাই অসম্পূর্ণ — সফলতা দাবি করা হয়নি। " + String(result && result.detail || "");
  }

  async function executePackageCommand(command, options, plugin) {
    const confirm = options.confirm || ((message) => root.confirm(message));
    const prompt = options.prompt || ((message) => root.prompt(message));
    const report = options.report || (() => {});
    let target = command.target;
    if (command.kind === "uninstall" && !target) {
      target = String(prompt("কোন ইনস্টল করা অ্যাপটি আনইনস্টল করবেন? Package name অথবা সঠিক অ্যাপের নাম লিখুন:") || "").trim();
      if (!target) {
        const cancelled = { status: "CANCELLED", action: "UNINSTALL_APP", packageStateVerified: false, detail: "অ্যাপের নাম দেওয়া হয়নি।" };
        report(packageResultMessage(cancelled));
        return cancelled;
      }
    }
    const label = command.kind === "pick-apk" ? "APK থেকে অ্যাপ ইনস্টল" :
      command.kind === "uninstall" ? "অ্যাপ আনইনস্টল: " + target :
      "Play Store-এ অ্যাপ খোঁজা: " + command.query;
    if (!(await Promise.resolve(confirm("MOSHARROF AI native Android কাজ প্রস্তুত করেছে: " + label +
        ". Android-এর নিজস্ব confirmation লাগবে। চালাবেন?")))) {
      const cancelled = { status: "CANCELLED", action: command.kind === "uninstall" ? "UNINSTALL_APP" : "INSTALL_APK", packageStateVerified: false, detail: "ওয়েব নিশ্চিতকরণ বাতিল হয়েছে।" };
      report(packageResultMessage(cancelled));
      return cancelled;
    }
    const requestId = packageRequestId();
    let method, payload;
    if (command.kind === "pick-apk") {
      method = "installAppFromPicker";
      payload = { requestId };
    } else if (command.kind === "uninstall") {
      method = "uninstallApp";
      payload = { requestId, target };
    } else {
      method = "searchPlayStore";
      payload = { requestId, query: command.query };
    }
    try {
      const result = await plugin[method](payload);
      const normalized = result && typeof result === "object" ? result : {
        requestId, status: "UNKNOWN", packageStateVerified: false,
        detail: "Native plugin কোনো যাচাইযোগ্য ফল ফেরত দেয়নি।"
      };
      report(packageResultMessage(normalized));
      return normalized;
    } catch (error) {
      const failed = { requestId, status: "FAILED", packageStateVerified: false,
        detail: String(error && error.message || error).slice(0, 200) };
      report(packageResultMessage(failed));
      return failed;
    }
  }

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
      const packageCommand = parsePackageCommand(command);
      if (packageCommand) {
        const plugin = getPlugin();
        const method = packageCommand.kind === "pick-apk" ? "installAppFromPicker" :
          packageCommand.kind === "uninstall" ? "uninstallApp" : "searchPlayStore";
        if (plugin && typeof plugin[method] === "function") {
          return { handled: true, promise: executePackageCommand(packageCommand, { ...options, report }, plugin) };
        }
      }
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

  const api = Object.freeze({ createCommandRouter, parsePackageCommand });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidAgentCommandRouter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
