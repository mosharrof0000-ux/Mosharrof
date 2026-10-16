import { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } from "./personal-memory-engine.js";

const CONSENT_KEY = "mosharrof-personal-memory-enabled-v1";
const DB_NAME = "mosharrof-personal-memory";
const DB_VERSION = 1;
const STORE = "state";
let initialized = false;

function createStorage() {
  let opening;
  function db() {
    if (!globalThis.indexedDB) throw new Error("এই ব্রাউজারে IndexedDB নেই।");
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("স্মৃতি ডেটাবেস খোলা যায়নি।"));
    });
    return opening;
  }
  async function run(mode, action) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("স্মৃতি ডেটাবেসে কাজ ব্যর্থ।"));
      tx.onabort = () => reject(tx.error || new Error("স্মৃতি ডেটাবেসের কাজ বাতিল হয়েছে।"));
    });
  }
  return {
    async getItem(key) {
      const row = await run("readonly", store => store.get(key));
      if (row && typeof row.value === "string") return row.value;
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) { await this.setItem(key, legacy); localStorage.removeItem(key); return legacy; }
      } catch {}
      return null;
    },
    async setItem(key, value) { return run("readwrite", store => store.put({ key, value: String(value) })); },
    async removeItem(key) { return run("readwrite", store => store.delete(key)); }
  };
}

export function initializePersonalMemory() {
  if (initialized || typeof window === "undefined" || !window.document) return;
  initialized = true;
  const nav = document.getElementById("navR");
  if (!nav || document.getElementById("personalMemoryPanel")) return;
  const section = document.createElement("section");
  section.className = "nav-family";
  section.id = "personalMemoryPanel";
  section.innerHTML =
    '<div class="nav-family-title"><span aria-hidden="true">🧠</span><span>ব্যক্তিগত স্মৃতি ইঞ্জিন</span></div>' +
    '<p>স্মৃতি এই ডিভাইসের IndexedDB-তে থাকবে। চালু করলে প্রাসঙ্গিক স্মৃতি AI-র উত্তরে ব্যবহার হতে পারে। ডিভাইসের স্টোরেজ সীমা প্রযোজ্য।</p>' +
    '<label><input type="checkbox" data-memory="enabled"> ব্যক্তিগত স্মৃতি চালু</label>' +
    '<div class="audio-setting-row"><input type="search" data-memory="query" placeholder="স্মৃতি খুঁজুন" aria-label="স্মৃতি খুঁজুন">' +
    '<select data-memory="folder" aria-label="স্মৃতির বিষয়"><option value="">সব বিষয়</option>' +
    '<option value="preference">ব্যক্তিগত পছন্দ</option><option value="goal">লক্ষ্য ও পরিকল্পনা</option>' +
    '<option value="project">প্রকল্প ও প্রযুক্তি</option><option value="correction">সংশোধন ও শেখা</option>' +
    '<option value="fact">তথ্য ও জ্ঞান</option><option value="event">সময়রেখা ও ঘটনা</option></select></div>' +
    '<div class="device-quick-actions"><button type="button" data-memory="search">খুঁজুন</button>' +
    '<button type="button" data-memory="refresh">সাম্প্রতিক স্মৃতি</button>' +
    '<button type="button" data-memory="export">ব্যাকআপ নিন</button>' +
    '<button type="button" data-memory="import">ব্যাকআপ ফেরত আনুন</button>' +
    '<input type="file" data-memory="file" accept="application/json,.json" hidden>' +
    '<button type="button" data-memory="clear">সব স্মৃতি মুছুন</button></div>' +
    '<div data-memory="status" role="status" aria-live="polite">মেমোরি ইঞ্জিন প্রস্তুত হচ্ছে…</div><div data-memory="results"></div>';
  nav.appendChild(section);

  const enabledInput = section.querySelector('[data-memory="enabled"]');
  const queryInput = section.querySelector('[data-memory="query"]');
  const folderInput = section.querySelector('[data-memory="folder"]');
  const status = section.querySelector('[data-memory="status"]');
  const results = section.querySelector('[data-memory="results"]');
  const fileInput = section.querySelector('[data-memory="file"]');
  let engine = null;
  let enabled = false;
  let nativeFetch = null;
  const savedSetting = () => { try { return localStorage.getItem(CONSENT_KEY); } catch { return null; } };
  function setStatus(value) { status.textContent = value; }

  function installChatHook() {
    if (nativeFetch || typeof window.fetch !== "function") return;
    nativeFetch = window.fetch.bind(window);
    window.fetch = async function(input, init = {}) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (!enabled || !engine || !/\/chat(?:\?|$)/.test(url) || typeof init.body !== "string") return nativeFetch(input, init);
      let body;
      try { body = JSON.parse(init.body); } catch { return nativeFetch(input, init); }
      const text = String(body.text || "").trim();
      if (!text) return nativeFetch(input, init);
      try {
        body.memory_context = buildPersonalMemoryContext(await engine.exportAll(), text);
        body.memory_suggestions_enabled = true;
        const candidates = inferMemoryCandidates(text);
        const ledger = await engine.exportAll();
        for (const candidate of candidates) {
          const duplicate = ledger.memories.some(item => item.status !== "superseded" && item.content === candidate.content && item.category === candidate.category);
          if (!duplicate) {
            await engine.remember(candidate);
            ledger.memories.push({ ...candidate, id: "candidate-local-" + ledger.memories.length });
          }
        }
      } catch (error) { console.warn("[MOSHARROF Memory] স্মৃতি ব্যবহার করা যায়নি; সাধারণ চ্যাট চলবে।", error); }
      return nativeFetch(input, { ...init, body: JSON.stringify(body) });
    };
  }

  async function setup() {
    try {
      engine = createPersonalMemoryEngine({ storage: createStorage() });
      enabled = savedSetting() === "enabled";
      enabledInput.checked = enabled;
      if (savedSetting() === null) localStorage.setItem(CONSENT_KEY, "disabled");
      installChatHook();
      setStatus(enabled ? "স্মৃতি চালু · এই ডিভাইসে সংরক্ষিত" : "স্মৃতি বন্ধ · নতুন স্মৃতি ব্যবহার হবে না");
      await refresh();
    } catch (error) {
      enabledInput.checked = false;
      enabled = false;
      setStatus("মেমোরি চালু করা যায়নি: " + (error.message || String(error)));
    }
  }

  async function refresh() {
    if (!engine) return;
    const result = await engine.recall({ folder: folderInput.value || undefined, limit: 40 });
    showRows(result.items);
    setStatus((enabled ? "স্মৃতি চালু" : "স্মৃতি বন্ধ") + " · মোট " + result.total + "টি স্মৃতি");
  }

  function showRows(rows) {
    results.textContent = "";
    if (!rows.length) { results.textContent = "এখানে এখনো স্মৃতি নেই।"; return; }
    rows.forEach(item => {
      const row = document.createElement("div");
      row.className = "device-quick-actions";
      const label = document.createElement("div");
      label.textContent = "📁 " + (item.folder || item.category) + " · " + String(item.status || "active") + " · " + String(item.created_at || "").slice(0, 10) + "\n" + String(item.content || "").slice(0, 360);
      const remove = document.createElement("button");
      remove.type = "button"; remove.textContent = "ভুলে যান";
      remove.addEventListener("click", async () => {
        if (!globalThis.confirm("এই স্মৃতিটি মুছে ফেলবেন?")) return;
        await engine.revise(item.id, { status: "archived" });
        await refresh();
      });
      row.append(label, remove); results.appendChild(row);
    });
  }

  async function search() {
    if (!engine || !enabled) { setStatus("স্মৃতি চালু করুন, তারপর খুঁজুন।"); return; }
    const result = await engine.recall({ query: queryInput.value.trim(), folder: folderInput.value || undefined, limit: 40 });
    showRows(result.items);
    setStatus("মিল পাওয়া গেছে: " + result.items.length + "টি");
  }

  enabledInput.addEventListener("change", async () => {
    enabled = enabledInput.checked;
    try { localStorage.setItem(CONSENT_KEY, enabled ? "enabled" : "disabled"); }
    catch { enabled = false; enabledInput.checked = false; }
    setStatus(enabled ? "স্মৃতি চালু হয়েছে। প্রাসঙ্গিক স্মৃতি AI-তে পাঠানো হতে পারে।" : "স্মৃতি বন্ধ; আগের স্মৃতি ডিভাইসে থাকবে, ব্যবহার হবে না।");
    await refresh();
  });

  section.addEventListener("click", async event => {
    const button = event.target.closest("button[data-memory]");
    if (!button || !engine) return;
    try {
      if (button.dataset.memory === "search") await search();
      if (button.dataset.memory === "refresh") await refresh();
      if (button.dataset.memory === "export") {
        const blob = new Blob([JSON.stringify(await engine.exportAll(), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = "mosharrof-memory-backup.json"; link.click(); URL.revokeObjectURL(url);
        setStatus("স্মৃতির ব্যাকআপ তৈরি হয়েছে।");
      }
      if (button.dataset.memory === "import") fileInput.click();
      if (button.dataset.memory === "clear") {
        if (!globalThis.confirm("এই ডিভাইসের সব ব্যক্তিগত স্মৃতি স্থায়ীভাবে মুছবেন?")) return;
        await engine.clear(); await refresh(); setStatus("সব ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে।");
      }
    } catch (error) { setStatus("ব্যর্থ: " + (error.message || String(error))); }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const result = await engine.importAll(JSON.parse(await file.text()));
      await refresh(); setStatus("ব্যাকআপ থেকে " + result.count + "টি স্মৃতি আনা হয়েছে।");
    } catch (error) { setStatus("ব্যাকআপ ফেরত আনা যায়নি: " + (error.message || String(error))); }
    finally { fileInput.value = ""; }
  });
  queryInput.addEventListener("keydown", event => { if (event.key === "Enter") search().catch(() => {}); });
  folderInput.addEventListener("change", () => refresh().catch(() => {}));
  setup();
}
