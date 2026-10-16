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
    const taskPlanner = options.taskPlanner || root.MosharrofAndroidTaskPlanner;
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

    function handle(command) {
      if (planner && typeof planner.planCommand === "function" &&
          executorApi && typeof executorApi.createExecutor === "function") {
        const plan = planner.planCommand(command);
        if (plan.status === "preview" && plan.steps.length &&
            plan.steps.every(step => Object.prototype.hasOwnProperty.call(ACTION_METHODS, step.action))) {
          return { handled: true, promise: executePlan(plan) };
        }
      }
      return handleFileTask(command);
    }

    function showFileOutput(message) {
      const status = root.document && root.document.getElementById("mosFileManagerStatus");
      const results = root.document && root.document.getElementById("mosFileManagerResults");
      if (status) status.textContent = message;
      if (results) results.textContent = message;
      report(message);
    }

    function handleFileTask(command) {
      if (!taskPlanner || typeof taskPlanner.planCommand !== "function") return { handled: false };
      const plan = taskPlanner.planCommand(command);
      if (plan.status !== "preview" || plan.steps.length !== 1) return { handled: false };
      const action = plan.steps[0].action;
      if (!["files_list", "files_create", "folder_create", "photos_group",
          "files_organize", "duplicates_scan"].includes(action)) return { handled: false };
      return { handled: true, promise: executeFileTask(action) };
    }

    async function executeFileTask(action) {
      const files = root.MosharrofFiles;
      if (!files) {
        showFileOutput("Android ফাইল ব্যবস্থাপনা APK-তে সংযুক্ত নেই।");
        return { status: "unavailable" };
      }
      try {
        if (action === "photos_group" || action === "files_organize") {
          const button = root.document && root.document.querySelector(
            '#mosMediaOrganizer [data-media="organize"]');
          if (!button) {
            showFileOutput("ছবি/গান সাজানোর UI প্রস্তুত নয়; ফাইল ব্যবস্থাপনা প্যানেল খুলুন।");
            return { status: "unavailable" };
          }
          button.click();
          report("ছবি/গান সাজানোর preview খুলেছি; ফাইল সরানোর আগে নিশ্চিতকরণ দিতে হবে।");
          return { status: "preview_opened" };
        }
        await files.getSelectedDirectory();
        if (action === "files_list") {
          const listing = await files.listEntries();
          const items = listing.items || [];
          const lines = items.slice(0, 50).map(item =>
            (item.isDirectory ? "📁 " : "📄 ") + item.name);
          if (items.length > 50) lines.push("… আরও " + (items.length - 50) + "টি");
          showFileOutput(lines.join("\n") || "নির্বাচিত ফোল্ডারটি খালি।");
          return { status: "completed", count: items.length };
        }
        if (action === "folder_create") {
          const name = root.prompt("নতুন ফোল্ডারের নাম");
          if (!name || !name.trim()) return { status: "cancelled" };
          if (!confirm('"' + name.trim() + '" ফোল্ডার তৈরি করবেন?')) return { status: "cancelled" };
          const result = await files.createFolder(name.trim());
          showFileOutput("ফোল্ডার তৈরির অনুরোধ সম্পন্ন হয়েছে: " + name.trim());
          return { status: "completed", result };
        }
        if (action === "files_create") {
          const name = root.prompt("নতুন ফাইলের নাম (যেমন notes.txt)");
          if (!name || !name.trim()) return { status: "cancelled" };
          const body = root.prompt("ফাইলের লেখা", "");
          if (body === null) return { status: "cancelled" };
          if (!confirm('"' + name.trim() + '" ফাইল তৈরি করবেন?')) return { status: "cancelled" };
          const result = await files.createTextFile(name.trim(), body);
          showFileOutput("ফাইল তৈরির অনুরোধ সম্পন্ন হয়েছে: " + name.trim());
          return { status: "completed", result };
        }
        if (action === "duplicates_scan") {
          if (!confirm("নির্বাচিত ফোল্ডারে SHA-256 ডুপ্লিকেট স্ক্যান করবেন? কোনো ফাইল মুছবে না।")) {
            return { status: "cancelled" };
          }
          const scan = await files.scanSelectedDirectoryDuplicates();
          const groups = scan.groups || [];
          const lines = groups.map(group => "একই কনটেন্ট (" + group.files.length + "টি): " +
            group.files.map(file => file.name).join(", "));
          lines.unshift("স্ক্যান: " + scan.filesScanned + "টি ফাইল; " + groups.length + "টি ডুপ্লিকেট গ্রুপ।");
          lines.push("কোনো ফাইল মুছেনি।");
          if (scan.truncated) lines.push("সীমার কারণে স্ক্যান অসম্পূর্ণ।");
          showFileOutput(lines.join("\n"));
          return { status: "completed", scanned: scan.filesScanned, groups: groups.length };
        }
      } catch (error) {
        showFileOutput("কাজ সম্পন্ন হয়নি: " + String(error && error.message || error));
        return { status: "failed", reason: String(error && error.message || error) };
      }
      return { status: "unavailable" };
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
