import { createMemoryEngine } from "../core/personal-memory/memory-engine.js";

const DB_NAME = "mosharrof-personal-memory";
const DB_VERSION = 1;
const STORE_NAME = "memories";
const CHAT_ENDPOINT_PART = "/chat";
let engine = null;
let currentConversationId = null;

function getConversationId() {
  try {
    let id = sessionStorage.getItem("mosharrof:conversation-id");
    if (!id) {
      id = globalThis.crypto?.randomUUID ? crypto.randomUUID() : "conversation-" + Date.now().toString(36);
      sessionStorage.setItem("mosharrof:conversation-id", id);
    }
    return id;
  } catch { return "tab-" + location.pathname; }
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB is unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
        store.createIndex("conversationId", "conversationId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open memory database"));
    request.onblocked = () => reject(new Error("Memory database upgrade is blocked by another tab"));
  });
}
function createIndexedDbStore(db) {
  function run(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = action(tx.objectStore(STORE_NAME));
      let result;
      if (request) request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || request?.error || new Error("Memory transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("Memory transaction aborted"));
    });
  }
  return {
    put: item => run("readwrite", store => store.put(item)),
    getAll: () => run("readonly", store => store.getAll()),
    delete: id => run("readwrite", store => store.delete(id)),
    clear: () => run("readwrite", store => store.clear())
  };
}
function addButton() {
  if (document.getElementById("mosharrof-memory-open")) return;
  const button = document.createElement("button");
  button.id = "mosharrof-memory-open";
  button.type = "button";
  button.textContent = "স্মৃতি";
  button.setAttribute("aria-label", "ব্যক্তিগত স্মৃতি ও বিষয়ভিত্তিক ফোল্ডার খুলুন");
  Object.assign(button.style, { position: "fixed", right: "14px", bottom: "88px", zIndex: "9998", border: "1px solid currentColor", borderRadius: "999px", padding: "9px 14px", background: "Canvas", color: "CanvasText", font: "inherit", cursor: "pointer", boxShadow: "0 3px 14px #0002" });
  button.addEventListener("click", showMemoryPanel);
  document.body.appendChild(button);
}
function showMemoryPanel() {
  let panel = document.getElementById("mosharrof-memory-panel");
  if (panel) { panel.remove(); return; }
  panel = document.createElement("section");
  panel.id = "mosharrof-memory-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "ব্যক্তিগত স্মৃতি");
  Object.assign(panel.style, { position: "fixed", inset: "8% 4% 8% 4%", zIndex: "9999", overflow: "auto", background: "Canvas", color: "CanvasText", border: "1px solid currentColor", borderRadius: "16px", padding: "18px", boxShadow: "0 12px 50px #0005", font: "inherit" });
  const heading = document.createElement("h2"); heading.textContent = "MOSHARROF AI · ব্যক্তিগত স্মৃতি"; panel.appendChild(heading);
  const description = document.createElement("p");
  description.textContent = "স্মৃতি বিষয় ও সময় অনুযায়ী সাজানো। বর্তমান কথাকে অগ্রাধিকার দেওয়া হয়। ডেটা এই ব্রাউজারের IndexedDB-তে থাকে; অ্যাপের নির্দিষ্ট এন্ট্রি-সীমা নেই, তবে ডিভাইস/ব্রাউজারের স্টোরেজ সীমা প্রযোজ্য।";
  panel.appendChild(description);
  const list = document.createElement("div"); list.textContent = "স্মৃতির ফোল্ডার লোড হচ্ছে…"; panel.appendChild(list);
  const actions = document.createElement("div"); Object.assign(actions.style, { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" });
  function action(label, handler) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label;
    Object.assign(b.style, { padding: "9px 12px", borderRadius: "9px", cursor: "pointer", font: "inherit" });
    b.addEventListener("click", handler); actions.appendChild(b);
  }
  action("স্মৃতি Export", async () => {
    const data = await engine.exportAll(), blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "mosharrof-memory-export.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  action("সব স্মৃতি মুছুন", async () => {
    if (!confirm("এই ব্রাউজারে সংরক্ষিত সব ব্যক্তিগত স্মৃতি স্থায়ীভাবে মুছে ফেলবেন? আগে চাইলে Export করুন।")) return;
    await engine.clearAll(); await refresh(); alert("এই ব্রাউজারের স্মৃতি মুছে ফেলা হয়েছে।");
  });
  action("বন্ধ করুন", () => panel.remove());
  panel.appendChild(actions); document.body.appendChild(panel);
  async function refresh() {
    const [folders, records] = await Promise.all([engine.listFolders(), engine.listRecords()]);
    list.replaceChildren();
    const count = document.createElement("p"); count.textContent = "সংরক্ষিত রেকর্ড: " + records.length; list.appendChild(count);
    if (!folders.length) { const empty = document.createElement("p"); empty.textContent = "এখনো কোনো স্মৃতি নেই। আপনার পরবর্তী কথোপকথন থেকে স্মৃতি তৈরি হবে।"; list.appendChild(empty); return; }
    for (const folder of folders) { const row = document.createElement("p"); row.textContent = "📁 " + folder.path + " · " + folder.count + "টি"; list.appendChild(row); }
    const sub = document.createElement("h3"); sub.textContent = "সাম্প্রতিক স্মৃতি"; list.appendChild(sub);
    for (const item of records.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)) {
      const row = document.createElement("p");
      row.textContent = "[" + item.createdAt.slice(0, 10) + "] " + (item.role === "user" ? "আপনি: " : item.kind === "preference" ? "পছন্দ: " : "AI: ") + (item.text || item.key + " = " + item.value).slice(0, 240);
      list.appendChild(row);
    }
  }
  refresh().catch(error => { list.textContent = "স্মৃতি পড়া যায়নি: " + String(error.message || error); });
}
function extractAssistantText(raw, contentType) {
  if (String(contentType || "").includes("text/event-stream")) {
    for (const block of raw.split(/\n\s*\n/)) {
      const line = block.split(/\r?\n/).find(item => item.startsWith("data:"));
      if (!line) continue;
      try { const event = JSON.parse(line.slice(5).trim()); if (event.type === "result" && event.data?.text) return String(event.data.text); } catch {}
    }
    return "";
  }
  try { const data = JSON.parse(raw); return String(data.text || ""); } catch { return ""; }
}
function installChatMemoryInterceptor() {
  if (window.__mosharrofMemoryInterceptor || !engine) return;
  window.__mosharrofMemoryInterceptor = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = typeof input === "string" || input instanceof URL ? String(input) : String(input?.url || "");
    if (!url.includes(CHAT_ENDPOINT_PART) || !init || typeof init.body !== "string") return originalFetch(input, init);
    let body; try { body = JSON.parse(init.body); } catch { return originalFetch(input, init); }
    if (typeof body.text !== "string" || !body.text.trim()) return originalFetch(input, init);
    const conversationId = currentConversationId || getConversationId();
    try { body.memory_context = await engine.buildContext(body.text, conversationId); }
    catch (error) { console.warn("[MOSHARROF memory] retrieval skipped:", error); }
    let response;
    try { response = await originalFetch(input, { ...init, body: JSON.stringify(body) }); }
    catch (error) {
      engine.recordMessage({ text: body.text, role: "user", conversationId }).catch(() => {});
      throw error;
    }
    engine.recordMessage({ text: body.text, role: "user", conversationId }).catch(error => console.warn("[MOSHARROF memory] save skipped:", error));
    response.clone().text().then(async raw => {
      const answer = extractAssistantText(raw, response.headers.get("content-type"));
      if (answer) await engine.recordMessage({ text: answer, role: "assistant", conversationId });
    }).catch(error => console.warn("[MOSHARROF memory] response archive skipped:", error));
    return response;
  };
}
function installNewConversationHook() {
  document.getElementById("btn-new-chat")?.addEventListener("click", () => {
    currentConversationId = globalThis.crypto?.randomUUID ? crypto.randomUUID() : "conversation-" + Date.now().toString(36);
    try { sessionStorage.setItem("mosharrof:conversation-id", currentConversationId); } catch {}
  });
}
async function initializePersonalMemory() {
  try {
    const db = await openDatabase();
    engine = createMemoryEngine({ store: createIndexedDbStore(db) });
    currentConversationId = getConversationId();
    installChatMemoryInterceptor(); installNewConversationHook(); addButton();
    console.info("[MOSHARROF memory] ready · topic folders · current-chat summary · relevant past retrieval");
  } catch (error) {
    console.warn("[MOSHARROF memory] unavailable:", error);
    const status = document.createElement("span"); status.textContent = "স্মৃতি অফলাইন"; status.title = "এই ব্রাউজারে IndexedDB উপলভ্য নয়";
    Object.assign(status.style, { position: "fixed", right: "12px", bottom: "12px", zIndex: "9998", fontSize: "12px" });
    document.body.appendChild(status);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializePersonalMemory, { once: true });
else initializePersonalMemory();
