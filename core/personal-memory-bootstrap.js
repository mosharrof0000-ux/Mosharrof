/* Transparent, local-first memory integration for the live chat request path. */
import { createIndexedDbMemoryStore, createPersonalMemoryEngine } from "./personal-memory-engine.js";

(function () {
  "use strict";
  const PREF_KEY = "mosharrof_personal_memory_enabled_v1";
  const CHAT_PATH = "/chat";
  let engine;
  let enabled = true;
  try { enabled = localStorage.getItem(PREF_KEY) !== "false"; } catch (_) {}
  const status = { ready: false, count: 0 };

  function readResponseText(response) {
    return response.clone().text().then(function (raw) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.indexOf("text/event-stream") !== -1) {
        const blocks = raw.split(/\r?\n\r?\n/);
        for (let i = blocks.length - 1; i >= 0; i -= 1) {
          const line = blocks[i].split(/\r?\n/).find(function (part) { return part.indexOf("data:") === 0; });
          if (!line) continue;
          try {
            const event = JSON.parse(line.slice(5).trim());
            if (event.type === "result" && event.data && event.data.text) return String(event.data.text);
          } catch (_) {}
        }
        return "";
      }
      try {
        const data = JSON.parse(raw);
        return String(data.text || "");
      } catch (_) { return ""; }
    });
  }

  function updateUI() {
    const button = document.getElementById("mosharrof-memory-launch");
    const count = document.getElementById("mosharrof-memory-count");
    const clear = document.getElementById("mosharrof-memory-clear");
    if (button) {
      button.textContent = "স্মৃতি: " + (enabled ? "চালু" : "বন্ধ");
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
      button.title = "আপনার ব্যক্তিগত স্মৃতি সেটিংস";
    }
    if (count) count.textContent = status.ready ? "এই ডিভাইসে " + status.count + "টি স্মৃতি-রেকর্ড আছে। অন্য ডিভাইসে স্বয়ংক্রিয়ভাবে যায় না।" : "স্থানীয় স্মৃতি চালু হচ্ছে…";
    if (clear) clear.disabled = !status.ready;
  }

  function mountControls() {
    if (document.getElementById("mosharrof-memory-panel")) return;
    const style = document.createElement("style");
    style.textContent = "#mosharrof-memory-launch{position:fixed;z-index:10001;left:10px;bottom:calc(76px + env(safe-area-inset-bottom,0px));border:1px solid #424242;border-radius:999px;padding:8px 12px;background:#171717;color:#f5f5f5;font:600 12px system-ui;box-shadow:0 3px 16px #0008}#mosharrof-memory-panel{position:fixed;z-index:10002;left:10px;bottom:calc(118px + env(safe-area-inset-bottom,0px));width:min(320px,calc(100vw - 20px));padding:14px;border:1px solid #454545;border-radius:16px;background:#171717;color:#f5f5f5;box-shadow:0 10px 35px #000b;font:13px/1.5 system-ui;display:none}#mosharrof-memory-panel.open{display:block}#mosharrof-memory-panel p{margin:8px 0;color:#c7c7c7}#mosharrof-memory-panel .memory-actions{display:flex;gap:8px;margin-top:10px}#mosharrof-memory-panel button{border:1px solid #555;border-radius:9px;padding:8px 10px;background:#242424;color:#fff;font:600 12px system-ui}#mosharrof-memory-panel button:disabled{opacity:.45}";
    document.head.appendChild(style);
    const launch = document.createElement("button");
    launch.id = "mosharrof-memory-launch";
    launch.type = "button";
    launch.textContent = "স্মৃতি: চালু";
    launch.setAttribute("aria-controls", "mosharrof-memory-panel");
    const panel = document.createElement("section");
    panel.id = "mosharrof-memory-panel";
    panel.setAttribute("aria-label", "ব্যক্তিগত স্মৃতি নিয়ন্ত্রণ");
    panel.innerHTML = '<strong>ব্যক্তিগত স্মৃতি</strong><p>বিষয়ভিত্তিক ফোল্ডার ও সময়রেখায় স্মৃতি থাকে। বর্তমান অনুরোধ আগে বিবেচিত হয়; পুরোনো স্মৃতি কেবল প্রাসঙ্গিক হলে সাহায্য করে। প্রাসঙ্গিক স্মৃতি উত্তর তৈরির সময় নির্বাচিত AI provider-এ পাঠানো হতে পারে। পাসওয়ার্ড/OTP-জাতীয় তথ্য সংরক্ষণ এড়ানো হয়। স্টোরেজ ডিভাইসের সীমাধীন।</p><p id="mosharrof-memory-count">স্থানীয় স্মৃতি চালু হচ্ছে…</p><div class="memory-actions"><button id="mosharrof-memory-enable" type="button">স্মৃতি বন্ধ করুন</button><button id="mosharrof-memory-inspect" type="button">স্মৃতি দেখুন</button><button id="mosharrof-memory-export" type="button">রপ্তানি</button><button id="mosharrof-memory-clear" type="button">সব মুছুন</button></div><pre id="mosharrof-memory-preview" style="white-space:pre-wrap;max-height:180px;overflow:auto;font-size:11px;margin-top:8px"></pre>';
    document.body.appendChild(launch);
    document.body.appendChild(panel);
    launch.addEventListener("click", function () { panel.classList.toggle("open"); });
    document.getElementById("mosharrof-memory-enable").addEventListener("click", function () {
      enabled = !enabled;
      if (engine) engine.setEnabled(enabled);
      try { localStorage.setItem(PREF_KEY, enabled ? "true" : "false"); } catch (_) {}
      updateUI();
      this.textContent = enabled ? "স্মৃতি বন্ধ করুন" : "স্মৃতি চালু করুন";
    });
    document.getElementById("mosharrof-memory-inspect").addEventListener("click", async function () {
      if (!engine) return;
      const preview = document.getElementById("mosharrof-memory-preview");
      try {
        const rows = await engine.timeline({ limit: 30 });
        const profile = await engine.profile();
        const folders = Object.entries(profile.folders || {}).sort((a,b) => b[1]-a[1]).map(([folder,count]) => folder + " (" + count + ")");
        preview.textContent = "বিষয়ভিত্তিক ফোল্ডার:\n" + (folders.join("\n") || "এখনও ফোল্ডার নেই") + "\n\nসাম্প্রতিক স্মৃতি:\n" + rows.slice().reverse().map(row => "[" + new Date(row.createdAt).toLocaleString() + "] " + (row.folder || "topics/general") + "\n" + String(row.summary || row.userText || row.assistantExcerpt || "").slice(0,180)).join("\n\n");
      } catch (_) { preview.textContent = "স্মৃতি পড়া যায়নি।"; }
    });
    document.getElementById("mosharrof-memory-export").addEventListener("click", async function () {
      if (!engine) return;
      try {
        const snapshot = await engine.exportAll();
        const blob = new Blob([JSON.stringify(snapshot,null,2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = "mosharrof-personal-memory.json"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (_) { window.alert("স্মৃতি রপ্তানি করা যায়নি।"); }
    });
    document.getElementById("mosharrof-memory-clear").addEventListener("click", function () {
      if (!engine || !window.confirm("এই ডিভাইসে সংরক্ষিত সব ব্যক্তিগত স্মৃতি মুছে ফেলবেন? চ্যাট হিস্ট্রি আলাদা থাকবে।")) return;
      engine.clear().then(function () { status.count = 0; updateUI(); }).catch(function () { window.alert("স্মৃতি মুছতে সমস্যা হয়েছে।"); });
    });
    updateUI();
  }

  async function initialize() {
    try {
      const store = createIndexedDbMemoryStore(window.indexedDB);
      engine = createPersonalMemoryEngine({ store: store, enabled: enabled });
      const profile = await engine.profile();
      status.count = profile.totalEntries;
      status.ready = true;
      updateUI();
    } catch (error) {
      console.warn("[MOSHARROF memory] local memory unavailable:", error);
      status.ready = false;
      updateUI();
    }
  }

  async function memoryCommand(text) {
    const value = String(text || "").trim();
    if (/^(?:আমার\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:দেখাও|দেখান|তালিকা|list)$/i.test(value)) {
      const rows = await engine.timeline({ limit: 30 });
      const profile = await engine.profile();
      const folders = Object.entries(profile.folders || {}).map(([name,count]) => name + " (" + count + ")").join(", ");
      const recent = rows.slice().reverse().map(row => "- [" + (row.folder || "topics/general") + "] " + String(row.summary || row.userText || "").slice(0,160)).join("\n");
      return "আপনার মোট " + profile.totalEntries + "টি স্মৃতি-রেকর্ড আছে।\nফোল্ডার: " + (folders || "এখনও নেই") + "\nসাম্প্রতিক স্মৃতি:\n" + (recent || "এখনও কোনো স্মৃতি নেই");
    }
    const explicit = value.match(/^(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*(.{3,})$/i);
    if (explicit) {
      const saved = await engine.rememberFact({ text: explicit[1].trim(), kind: "explicit_memory", source: "explicit_user_command", confidence: "user-confirmed" });
      return saved.saved ? "আপনার কথাটি স্মৃতিতে রেখেছি। ফোল্ডার: " + (saved.folder || "বিষয়ভিত্তিক স্মৃতি") : "নিরাপত্তা বা খালি তথ্যের কারণে এই কথাটি সংরক্ষণ করা যায়নি।";
    }
    if (/^(?:আমার\s*)?(?:সব\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)$/i.test(value)) {
      if (!window.confirm("এই ডিভাইসের সব ব্যক্তিগত স্মৃতি মুছে ফেলবেন? চ্যাট ইতিহাস আলাদা থাকবে।")) return "স্মৃতি মোছা বাতিল করা হয়েছে।";
      const result = await engine.clear();
      status.count = 0; updateUI();
      return result.cleared + "টি স্মৃতি-রেকর্ড মুছে ফেলা হয়েছে।";
    }
    return null;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const isChat = url.indexOf(CHAT_PATH) !== -1 && init && typeof init.body === "string";
    if (!isChat || !engine) return originalFetch(input, init);
    let body;
    try { body = JSON.parse(init.body); } catch (_) { return originalFetch(input, init); }
    const userText = String(body.text || "").trim();
    if (!userText) return originalFetch(input, init);
    try {
      const commandReply = await memoryCommand(userText);
      if (commandReply !== null) return new Response(JSON.stringify({ ok: true, provider: "local-memory", model: "personal-memory-engine", text: commandReply }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
    } catch (error) { console.warn("[MOSHARROF memory] command failed:", error); }
    if (!enabled) return originalFetch(input, init);
    try {
      const memoryContext = await engine.buildContext(userText, { limit: 8, maxChars: 3600 });
      const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
      const currentSummary = history.map(item => (item.role === "ai" ? "AI: " : "User: ") + String(item.text || "").replace(/\s+/g, " ").slice(0, 180)).filter(Boolean).join("\n");
      body.memory_context = [currentSummary ? "CURRENT CHAT SUMMARY (recent turns, not long-term truth):\n" + currentSummary : "", memoryContext].filter(Boolean).join("\n\n").slice(0, 6000);
    } catch (error) { console.warn("[MOSHARROF memory] recall skipped:", error); }
    const response = await originalFetch(input, Object.assign({}, init, { body: JSON.stringify(body) }));
    readResponseText(response).then(async function (assistantText) {
      if (!assistantText) return;
      try {
        await engine.rememberTurn({ userText: userText, assistantText: assistantText });
        const profile = await engine.profile();
        status.count = profile.totalEntries;
        updateUI();
      } catch (error) { console.warn("[MOSHARROF memory] save skipped:", error); }
    }).catch(function () {});
    return response;
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountControls, { once: true });
  else mountControls();
  initialize();
})();
