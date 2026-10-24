/* Explicit install/uninstall chat commands for the native MOSHARROF Android wrapper. */
(function (root) {
  "use strict";

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
      target = target.replace(/^(?:app|the app|অ্যাপ)\s+/iu, "").trim();
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
    let target = command.target;
    if (command.kind === "uninstall" && !target) {
      target = String(options.prompt("কোন ইনস্টল করা অ্যাপটি আনইনস্টল করবেন? Package name অথবা সঠিক অ্যাপের নাম লিখুন:") || "").trim();
      if (!target) {
        const cancelled = { status: "CANCELLED", action: "UNINSTALL_APP", packageStateVerified: false, detail: "অ্যাপের নাম দেওয়া হয়নি।" };
        options.report(packageResultMessage(cancelled));
        return cancelled;
      }
    }
    const label = command.kind === "pick-apk" ? "APK থেকে অ্যাপ ইনস্টল" :
      command.kind === "uninstall" ? "অ্যাপ আনইনস্টল: " + target :
      "Play Store-এ অ্যাপ খোঁজা: " + command.query;
    if (!(await Promise.resolve(options.confirm("MOSHARROF AI native Android কাজ প্রস্তুত করেছে: " + label +
        ". Android-এর নিজস্ব confirmation লাগবে। চালাবেন?")))) {
      const cancelled = { status: "CANCELLED", action: command.kind === "uninstall" ? "UNINSTALL_APP" : "INSTALL_APK", packageStateVerified: false, detail: "ওয়েব নিশ্চিতকরণ বাতিল হয়েছে।" };
      options.report(packageResultMessage(cancelled));
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
      options.report(packageResultMessage(normalized));
      return normalized;
    } catch (error) {
      const failed = { requestId, status: "FAILED", packageStateVerified: false,
        detail: String(error && error.message || error).slice(0, 200) };
      options.report(packageResultMessage(failed));
      return failed;
    }
  }

  function createPackageCommandRouter(options = {}) {
    const getPlugin = options.getPlugin || (() => {
      const plugins = root.Capacitor && root.Capacitor.Plugins;
      return plugins && plugins.AppPackage;
    });
    const confirm = options.confirm || ((message) => root.confirm(message));
    const prompt = options.prompt || ((message) => root.prompt(message));
    const report = options.report || ((message) => {
      const toast = root.document && root.document.getElementById("toast");
      if (toast) {
        toast.textContent = message;
        toast.classList.add("show");
        root.setTimeout(() => toast.classList.remove("show"), 3600);
      }
    });

    function handle(command) {
      const parsed = parsePackageCommand(command);
      if (!parsed) return { handled: false };
      const plugin = getPlugin();
      const method = parsed.kind === "pick-apk" ? "installAppFromPicker" :
        parsed.kind === "uninstall" ? "uninstallApp" : "searchPlayStore";
      if (!plugin || typeof plugin[method] !== "function") return { handled: false };
      return {
        handled: true,
        promise: executePackageCommand(parsed, { confirm, prompt, report }, plugin)
      };
    }
    return Object.freeze({ handle });
  }

  const api = Object.freeze({ createPackageCommandRouter, parsePackageCommand });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidAppPackageCommandRouter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
