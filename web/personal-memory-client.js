import { createIndexedDbMemoryStore, createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } from "./personal-memory-engine.js";

const SECRET_LIKE = /(password|passcode|api[_ -]?key|access[_ -]?token|secret|verification code|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|cvv)/i;
const COMMAND = /^(?:(?:আমার\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:দেখাও|দেখান|তালিকা|list)|(?:আমার\s*)?(?:সব\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)|(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*.+)$/i;

export function isPersonalMemoryCommand(text) {
  return COMMAND.test(String(text || "").trim());
}
export function createBrowserPersonalMemory() {
  const engine = createPersonalMemoryEngine({ store: createIndexedDbMemoryStore() });
  async function observe(text) {
    const value = String(text || "").trim();
    if (!value || SECRET_LIKE.test(value)) return;
    const candidates = inferMemoryCandidates(value);
    if (!candidates.length) return;
    const existing = await engine.all({ limit: 200 });
    for (const candidate of candidates) {
      const duplicate = existing.items.some(item => item.status !== "superseded" && item.content === candidate.content && item.category === candidate.category);
      if (!duplicate) await engine.remember(candidate);
    }
  }
  async function context(text) {
    const result = await engine.recall({ query: String(text || ""), limit: 8 });
    return buildPersonalMemoryContext(result.items, String(text || ""));
  }
  async function recordTurn(userText, assistantText, conversationId) {
    if (SECRET_LIKE.test(String(userText || "")) || SECRET_LIKE.test(String(assistantText || ""))) return;
    return engine.recordTurn(userText, assistantText, { conversation_id: conversationId });
  }
  async function command(text) {
    const value = String(text || "").trim();
    if (/^(?:আমার\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:দেখাও|দেখান|তালিকা|list)$/i.test(value)) {
      const report = await engine.all({ includeArchived: true, limit: 50 });
      if (!report.total) return "এখনও কোনো ব্যক্তিগত স্মৃতি সংরক্ষিত নেই।";
      return "আপনার স্মৃতির সাম্প্রতিক " + report.items.length + "টি নথি (মোট " + report.total + "টি):\n" + report.items.map(item => "- [" + item.folder + " · " + item.category + " · " + String(item.status || "active") + " · " + String(item.created_at || "").slice(0,10) + "] " + item.content.slice(0,700)).join("\n");
    }
    if (/^(?:আমার\s*)?(?:সব\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)$/i.test(value)) {
      if (!globalThis.confirm("সংরক্ষিত সব ব্যক্তিগত স্মৃতি মুছে ফেলবেন? চ্যাটের ইতিহাস আলাদাভাবে থাকবে।")) return "স্মৃতি মোছা বাতিল করা হয়েছে।";
      await engine.clear();
      return "ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে। চ্যাটের ইতিহাস আলাদাভাবে অক্ষত আছে।";
    }
    const explicit = value.match(/^(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*(.{3,})$/i);
    if (explicit) {
      if (SECRET_LIKE.test(explicit[1])) return "নিরাপত্তার জন্য পাসওয়ার্ড, API key, টোকেন বা গোপন কোড ব্যক্তিগত স্মৃতিতে রাখছি না।";
      const result = await engine.remember({ category: "fact", content: explicit[1].trim(), confidence: 1, source: "explicit_user_command", status: "active", user_confirmed: true, explicit: true });
      if (!result.saved) return "নিরাপত্তার কারণে এই তথ্য স্মৃতিতে সংরক্ষণ করা হয়নি।";
      return "আপনার কথাটি ব্যক্তিগত স্মৃতিতে সংরক্ষণ করেছি। দেখতে চাইলে লিখুন: “আমার স্মৃতি দেখাও”।";
    }
    return "স্মৃতি কমান্ডটি বোঝা যায়নি।";
  }
  return Object.freeze({ observe, context, recordTurn, command, recall: options => engine.recall(options), clear: () => engine.clear(), exportAll: () => engine.exportAll() });
}

const CONSENT_KEY = "mosharrof-personal-memory-enabled-v1";
const CHAT_URL = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/chat";
let bridgeInstalled = false;

export function installPersonalMemoryBridge(win = globalThis.window) {
  if (!win || typeof win.fetch !== "function" || bridgeInstalled) return null;
  bridgeInstalled = true;
  const originalFetch = win.fetch.bind(win);
  const memoryReady = Promise.resolve().then(() => createBrowserPersonalMemory());
  const enabled = () => {
    try { return win.localStorage.getItem(CONSENT_KEY) !== "disabled"; }
    catch (_) { return true; }
  };
  win.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!url.startsWith(CHAT_URL) || !init || typeof init.body !== "string") {
      return originalFetch(input, init);
    }
    let body;
    try { body = JSON.parse(init.body); } catch (_) { return originalFetch(input, init); }
    const userText = String(body.text || "").trim();
    if (!userText) return originalFetch(input, init);
    const memory = await memoryReady.catch(error => {
      console.warn("[MOSHARROF Memory] startup failed", error);
      return null;
    });
    if (!memory) return originalFetch(input, init);

    if (isPersonalMemoryCommand(userText)) {
      const answer = await memory.command(userText);
      const data = { ok: true, provider: "local-memory", model: "personal-memory", text: answer, attempted: [] };
      const event = { type: "result", status: 200, data };
      return new Response("data: " + JSON.stringify(event) + "\n\n", {
        status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" }
      });
    }

    if (enabled()) {
      try {
        await memory.observe(userText);
        body.memory_context = await memory.context(userText);
        body.memory_suggestions_enabled = true;
      } catch (error) {
        console.warn("[MOSHARROF Memory] retrieval skipped", error);
      }
    } else {
      body.memory_context = "";
      body.memory_suggestions_enabled = false;
    }
    const response = await originalFetch(input, { ...init, body: JSON.stringify(body) });
    response.clone().text().then(async raw => {
      if (!enabled() || isPersonalMemoryCommand(userText)) return;
      try {
        let answer = "", candidates = [];
        if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
          for (const block of raw.split(/\r?\n\r?\n/)) {
            for (const line of block.split(/\r?\n/)) {
              if (!line.startsWith("data:")) continue;
              try {
                const event = JSON.parse(line.slice(5).trim());
                if (event.type === "result" && event.status >= 200 && event.status < 300) {
                  answer = String(event.data && event.data.text || "");
                  candidates = Array.isArray(event.data && event.data.memory_candidates) ? event.data.memory_candidates : [];
                }
              } catch (_) {}
            }
          }
        } else {
          const data = JSON.parse(raw);
          if (response.ok && data.ok !== false) {
            answer = String(data.text || "");
            candidates = Array.isArray(data.memory_candidates) ? data.memory_candidates : [];
          }
        }
        if (answer.trim()) await memory.recordTurn(userText, answer, body.conversation_id || "local-chat");
        for (const candidate of candidates) {
          if (candidate && typeof candidate.content === "string") await memory.observe(candidate.content);
        }
      } catch (error) {
        console.warn("[MOSHARROF Memory] turn save skipped", error);
      }
    }).catch(() => {});
    return response;
  };
  win.MosharrofPersonalMemoryBridge = Object.freeze({ ready: memoryReady });
  return win.MosharrofPersonalMemoryBridge;
}

if (typeof window !== "undefined" && window.document) installPersonalMemoryBridge(window);
