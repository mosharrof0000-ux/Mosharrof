import { createUiModuleOrgan } from "../../core/ui-module-adapter/index.js";
const organ = createUiModuleOrgan("android-agent-bridge");
export const organId = organ.organId;
export const initialize = organ.initialize;
export const getHealth = organ.getHealth;
export const reportIssue = organ.reportIssue;

/* Explicit, session-scoped Android pairing and app-package task bridge for MOSHARROF chat. */
(function () {
  "use strict";
  const API = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/device";
  const SESSION_KEY = "mosharrof_android_device_pair_v1";
  const $ = (selector) => document.querySelector(selector);

  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return value && typeof value.deviceId === "string" && typeof value.browserToken === "string" ? value : null;
    } catch (_) { return null; }
  }
  function saveSession(value) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch (_) {}
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }
  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      method: options.method || "GET",
      headers: Object.assign({ "Content-Type": "application/json" }, options.token ? { Authorization: "Bearer " + options.token } : {}),
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || ("HTTP " + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function showPanelStatus(message) {
    const node = $("#mosDeviceBridgeStatus");
    if (node) node.textContent = message;
  }
  function appendMessage(role, text) {
    const list = $("#messages");
    if (!list) return;
    const node = document.createElement("div");
    node.className = "message " + (role === "user" ? "user" : "ai");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = role === "user" ? "আপনি · Android কমান্ড" : "MOSHARROF AI · Android Bridge";
    node.appendChild(label);
    node.appendChild(document.createTextNode(String(text || "")));
    list.appendChild(node);
    const scroller = $("#chatScroll");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }
  function classify(text) {
    const value = String(text || "").trim().replace(/[।.!?]+$/u, "").trim();
    if (!value) return null;
    const lower = value.toLowerCase();
    let match = value.match(/^(?:install|ইনস্টল(?:\s+কর(?:ো|ুন)?)?)\s*(.*)$/iu);
    if (match) {
      const target = String(match[1] || "").trim();
      if (!target || /^(?:apk|app|application|অ্যাপ|এপিকে)$/iu.test(target)) {
        return { action: "INSTALL_APK", target: "", display: value };
      }
      return { action: "SEARCH_PLAY_STORE", target: target.slice(0, 120), display: value };
    }
    match = value.match(/^(?:uninstall|remove app|আনইনস্টল(?:\s+কর(?:ো|ুন)?)?|অ্যাপ সরান)\s*(.*)$/iu);
    let target = match ? String(match[1] || "").trim() : "";
    if (!match) {
      match = value.match(/^(.+?)\s+আনইনস্টল(?:\s+কর(?:ো|ুন)?)?$/iu);
      if (match) target = String(match[1] || "").trim();
    }
    if (match) {
      if (!target || /^(?:app|application|অ্যাপ)$/iu.test(target)) {
        return { invalid: true, display: value, reason: "কোন অ্যাপটি আনইনস্টল করতে হবে তার সঠিক নাম লিখুন।" };
      }
      return { action: "UNINSTALL_APP", target: target.slice(0, 120), display: value };
    }
    if (/^disconnect android$/iu.test(lower) || /^অ্যান্ড্রয়েড সংযোগ বিচ্ছিন্ন করুন$/u.test(value)) {
      return { disconnect: true, display: value };
    }
    return null;
  }
  async function pairFromPrompt() {
    const code = window.prompt("Android Agent অ্যাপে দেখানো ৬ সংখ্যার pairing code লিখুন। কোডটি চ্যাটে পাঠানো হবে না।");
    if (code === null) return;
    const clean = String(code).trim();
    if (!/^\d{6}$/.test(clean)) {
      showPanelStatus("ভুল কোড: ৬টি সংখ্যা লিখুন।");
      return;
    }
    showPanelStatus("ফোনের pairing code যাচাই হচ্ছে…");
    try {
      const result = await request("/pair/approve", { method: "POST", body: { pairingCode: clean } });
      saveSession({ deviceId: result.deviceId, browserToken: result.browserToken });
      showPanelStatus("ফোন যুক্ত হয়েছে। এই ব্রাউজার সেশনে নিরাপদ কমান্ড পাঠানো যাবে।");
    } catch (error) {
      showPanelStatus(error.status === 410 ? "কোডের মেয়াদ শেষ। ফোনে নতুন pairing code তৈরি করুন।" :
        error.status === 401 ? "কোড মেলেনি বা চেষ্টা-সীমা শেষ হয়েছে। নতুন কোড তৈরি করুন।" :
        "ফোন যুক্ত করা যায়নি: " + String(error.message || "সংযোগ ব্যর্থ"));
    }
  }
  async function disconnect() {
    const session = readSession();
    if (!session) { clearSession(); showPanelStatus("কোনো ফোন যুক্ত নেই।"); return; }
    try {
      await request("/revoke", { method: "POST", token: session.browserToken, body: {} });
      clearSession();
      showPanelStatus("ফোনের pairing বাতিল হয়েছে।");
      return true;
    } catch (_) {
      showPanelStatus("সার্ভার pairing বাতিল নিশ্চিত করেনি; নিরাপত্তার জন্য টোকেন রাখা হয়েছে যাতে আবার চেষ্টা করা যায়।");
      return false;
    }
  }
  function waitForResult(requestId, token, action, startedAt) {
    return new Promise((resolve) => {
      const deadline = startedAt + 130000;
      async function check() {
        try {
          const data = await request("/results?requestId=" + encodeURIComponent(requestId), { token });
          const result = data.result || {};
          const isStoreHandoff = action === "SEARCH_PLAY_STORE" && result.status === "AWAITING_USER_CONFIRMATION";
          const done = ["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNKNOWN"].includes(result.status) || isStoreHandoff;
          if (done) {
            resolve({ text: formatResult(result), responseMeta: { provider: "Android device", model: "paired-agent", attempted: [] } });
            return;
          }
          if (Date.now() >= deadline) {
            resolve({ text: "ফোন থেকে চূড়ান্ত ফল আসেনি। এটি সফল বলে ধরা হচ্ছে না; অ্যাপটি অনলাইনে আছে কি না দেখুন। অনুরোধ ID: " + requestId,
              responseMeta: { provider: "Android device", model: "timeout", attempted: [] } });
            return;
          }
          window.setTimeout(check, 1800);
        } catch (error) {
          resolve({ text: "ফোনের ফলাফল পড়া যায়নি: " + String(error.message || "সংযোগ ব্যর্থ") + "। অনুরোধ ID: " + requestId,
            responseMeta: { provider: "Android device", model: "error", attempted: [] } });
        }
      }
      check();
    });
  }
  function formatResult(result) {
    const status = String(result.status || "UNKNOWN");
    const detail = String(result.detail || "ফলাফলের বিস্তারিত পাওয়া যায়নি।");
    return "Android কাজের ফল: " + status + "\n" + detail +
      (result.packageName ? "\nপ্যাকেজ: " + result.packageName : "") +
      "\nঅনুরোধ ID: " + String(result.requestId || "");
  }
  async function handleClassified(command) {
    if (command.invalid) return { text: command.reason, responseMeta: { provider: "Android device", model: "validation", attempted: [] } };
    if (command.disconnect) {
      const revoked = await disconnect();
      return { text: revoked ? "Android pairing সংযোগ বিচ্ছিন্ন হয়েছে।" :
        "সার্ভার pairing বাতিল নিশ্চিত করেনি; সংযোগ বিচ্ছিন্ন হয়েছে বলে ধরা হচ্ছে না।",
        responseMeta: { provider: "Android device", model: "pairing", attempted: [] } };
    }
    const session = readSession();
    if (!session) {
      return { text: "এই ব্রাউজারে কোনো Android Agent যুক্ত নেই। ফোনে MOSHARROF Android Agent খুলে “MOSHARROF AI-এর সঙ্গে যুক্ত করুন” চাপুন। ফোনে দেখানো কোডটি ডান মেনু → “Android ফোন যুক্ত করুন”-এ লিখুন। তারপর কমান্ডটি আবার পাঠান।",
        responseMeta: { provider: "Android device", model: "not-paired", attempted: [] } };
    }
    try {
      const queued = await request("/commands", {
        method: "POST", token: session.browserToken,
        body: { action: command.action, target: command.target }
      });
      showPanelStatus("Android কমান্ড পাঠানো হয়েছে; ফোনের নিশ্চিতকরণ/ফলাফলের অপেক্ষায়…");
      return await waitForResult(queued.requestId, session.browserToken, command.action, Date.now());
    } catch (error) {
      if (error.status === 401) clearSession();
      return { text: "Android কমান্ড পাঠানো যায়নি: " + String(error.message || "সংযোগ ব্যর্থ") + "। কোনো সফলতা দাবি করা হচ্ছে না।",
        responseMeta: { provider: "Android device", model: "dispatch-error", attempted: [] } };
    }
  }
  function intercept(event) {
    if (event && event.type === "keydown" && (event.key !== "Enter" || event.shiftKey)) return;
    const input = $("#input");
    const button = $("#sendBtn");
    if (!input || (button && button.disabled)) return;
    const command = classify(input.value);
    if (!command) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const display = command.display;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    appendMessage("user", display);
    appendMessage("ai", "Android কমান্ড যাচাই ও পাঠানো হচ্ছে…");
    const list = $("#messages");
    const placeholder = list && list.lastElementChild;
    if (button) button.disabled = true;
    handleClassified(command).then((result) => {
      if (placeholder && placeholder.parentNode) {
        placeholder.replaceChildren();
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = "MOSHARROF AI · Android Bridge";
        placeholder.appendChild(label);
        placeholder.appendChild(document.createTextNode(result.text));
      } else appendMessage("ai", result.text);
      showPanelStatus(result.text);
    }).catch(() => {
      if (placeholder) placeholder.textContent = "Android কমান্ড ব্যর্থ হয়েছে; সফলতা যাচাই করা যায়নি।";
    }).finally(() => {
      if (button) button.disabled = false;
      input.focus();
    });
  }
  function init() {
    const nav = $("#navR");
    if (nav && !$("#mosDevicePairingPanel")) {
      const section = document.createElement("section");
      section.className = "nav-family";
      section.id = "mosDevicePairingPanel";
      section.innerHTML = '<div class="nav-family-title"><span aria-hidden="true">▣</span><span>Android ফোন সংযোগ</span></div>' +
        '<p>ফোনের নিজস্ব নিশ্চিতকরণ ছাড়া ইনস্টল/আনইনস্টল হবে না।</p>' +
        '<div class="nav-family-items"><button type="button" id="mosPairAndroid">Android ফোন যুক্ত করুন</button>' +
        '<button type="button" id="mosDisconnectAndroid">সংযোগ বিচ্ছিন্ন করুন</button></div>' +
        '<p id="mosDeviceBridgeStatus" role="status" aria-live="polite"></p>';
      nav.appendChild(section);
      $("#mosPairAndroid").addEventListener("click", pairFromPrompt);
      $("#mosDisconnectAndroid").addEventListener("click", disconnect);
      showPanelStatus(readSession() ? "এই ব্রাউজার সেশনে ফোন যুক্ত আছে।" : "ফোন যুক্ত করতে Android Agent-এ pairing code তৈরি করুন।");
    }
    const button = $("#sendBtn");
    const input = $("#input");
    if (button) button.addEventListener("click", intercept, true);
    if (input) input.addEventListener("keydown", intercept, true);
  }
  window.MosharrofDeviceBridge = Object.freeze({ classify });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
