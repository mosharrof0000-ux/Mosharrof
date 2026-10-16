import { createPersonalMemoryEngine } from "./personal-memory-engine.js";

const CONSENT_KEY = "mosharrof-personal-memory-enabled-v1";
const DB_NAME = "mosharrof-personal-memory";
const DB_VERSION = 1;
const STORE = "state";
let initialized = false;

function createIndexedDbStorage(indexedDB, localStorage) {
  let opening;
  function database() {
    if (!indexedDB) throw new Error("এই ব্রাউজারে IndexedDB নেই; স্মৃতি সংরক্ষণ করা যায়নি।");
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
  async function transact(mode, action) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("স্মৃতি ডেটাবেসে কাজ ব্যর্থ।"));
      tx.onabort = () => reject(tx.error || new Error("স্মৃতি ডেটাবেসের কাজ বাতিল হয়েছে।"));
    });
  }
  return {
    async getItem(key) {
      const row = await transact("readonly", store => store.get(key));
      if (row && typeof row.value === "string") return row.value;
      try {
        const legacy = localStorage && localStorage.getItem(key);
        if (legacy) { await this.setItem(key, legacy); localStorage.removeItem(key); return legacy; }
      } catch (_) {}
      return null;
    },
    async setItem(key, value) { return transact("readwrite", store => store.put({ key, value: String(value) })); },
    async removeItem(key) { return transact("readwrite", store => store.delete(key)); }
  };
}

export function initializePersonalMemory() {
  if (initialized || typeof window === "undefined" || !window.document) return;
  const nav = document.getElementById("navR");
  if (!nav || document.getElementById("personalMemoryPanel")) return;
  initialized = true;
  const section = document.createElement("section");
  section.className = "nav-family";
  section.id = "personalMemoryPanel";
  section.innerHTML =
    '<div class="nav-family-title"><span aria-hidden="true">▤</span><span>ব্যক্তিগত স্মৃতি ইঞ্জিন</span></div>' +
    '<p>স্মৃতি এই ডিভাইসের IndexedDB-তে থাকবে। চালু করলে প্রাসঙ্গিক স্মৃতির অংশ উত্তরের জন্য AI সার্ভারে পাঠানো হতে পারে। ডিভাইসের স্টোরেজ সীমা প্রযোজ্য।</p>' +
    '<label><input type="checkbox" data-memory="enabled"> ব্যক্তিগত স্মৃতি চালু</label>' +
    '<div class="audio-setting-row"><input type="search" data-memory="query" placeholder="বিষয় বা স্মৃতি খুঁজুন" aria-label="স্মৃতি খুঁজুন">' +
    '<select data-memory="folder" aria-label="স্মৃতির ফোল্ডার"><option value="">সব বিষয়</option>' +
    '<option value="preference">ব্যক্তিগত পছন্দ</option><option value="goal">লক্ষ্য ও পরিকল্পনা</option><option value="project">প্রকল্প ও প্রযুক্তি</option>' +
    '<option value="correction">সংশোধন ও শেখা</option><option value="fact">গবেষণা ও জ্ঞান</option><option value="event">সময়রেখা ও ঘটনা</option><option value="open_question">খোলা প্রশ্ন</option></select></div>' +
    '<div class="device-quick-actions"><button type="button" data-memory="search">খুঁজুন</button>' +
    '<button type="button" data-memory="refresh">সাম্প্রতিক স্মৃতি</button>' +
    '<button type="button" data-memory="export">ব্যাকআপ নিন</button>' +
    '<button type="button" data-memory="import">ব্যাকআপ ফেরত আনুন</button>' +
    '<input type="file" data-memory="file" accept="application/json,.json" hidden>' +
    '<button type="button" data-memory="clear">সব স্মৃতি মুছুন</button></div>' +
    '<div data-memory="status" role="status" aria-live="polite">মেমোরি ইঞ্জিন প্রস্তুত হচ্ছে…</div>' +
    '<div data-memory="results"></div>';
  nav.appendChild(section);

  const enabledInput = section.querySelector('[data-memory="enabled"]');
  const queryInput = section.querySelector('[data-memory="query"]');
  const folderInput = section.querySelector('[data-memory="folder"]');
  const status = section.querySelector('[data-memory="status"]');
  const results = section.querySelector('[data-memory="results"]');
  const fileInput = section.querySelector('[data-memory="file"]');
  let engine = null;
  let enabled = false;
  function setStatus(value) { status.textContent = value; }
  async function setup() {
    try {
      const storage = createIndexedDbStorage(window.indexedDB, window.localStorage);
      engine = createPersonalMemoryEngine({ storage, namespace: "mosharrof.personal-memory.v1" });
      try { enabled = window.localStorage.getItem(CONSENT_KEY) === "enabled"; } catch (_) { enabled = false; }
      enabledInput.checked = enabled;
      if (!window.localStorage.getItem(CONSENT_KEY)) window.localStorage.setItem(CONSENT_KEY, "disabled");
      await refresh();
    } catch (error) {
      enabledInput.checked = false;
      enabled = false;
      setStatus("মেমোরি চালু করা যায়নি: " + (error.message || String(error)));
    }
  }
  async function refresh() {
    if (!engine) return;
    const report = await engine.recall({ folder: folderInput.value || undefined, limit: 40 });
    showRows(report.items);
    setStatus((enabled ? "স্মৃতি চালু" : "স্মৃতি বন্ধ") + " · মোট " + report.total + "টি · বিষয়ভিত্তিক ফোল্ডার · স্টোরেজের বাস্তব সীমা প্রযোজ্য");
  }
  function showRows(rows) {
    results.textContent = "";
    if (!rows.length) { results.textContent = "এই ফোল্ডারে এখনো স্মৃতি নেই।"; return; }
    rows.forEach(item => {
      const row = document.createElement("div");
      row.className = "device-quick-actions";
      const label = document.createElement("div");
      label.textContent = "📁 " + (item.folder || item.category) + " · " + new Date(item.created_at).toLocaleString() + "\n" + item.content.slice(0,360);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "আর্কাইভ করুন";
      remove.addEventListener("click", async () => {
        if (!confirm("এই স্মৃতিটি আর্কাইভ করবেন?")) return;
        await engine.revise(item.id, { status: "archived" });
        await refresh();
      });
      row.append(label, remove);
      results.appendChild(row);
    });
  }
  async function search() {
    if (!engine || !enabled) { setStatus("স্মৃতি চালু করুন, তারপর খুঁজুন।"); return; }
    const report = await engine.recall({ query: queryInput.value.trim(), folder: folderInput.value || undefined, limit: 40 });
    showRows(report.items);
    setStatus("মিল পাওয়া গেছে: " + report.items.length + "টি");
  }
  enabledInput.addEventListener("change", async () => {
    enabled = enabledInput.checked;
    try { window.localStorage.setItem(CONSENT_KEY, enabled ? "enabled" : "disabled"); }
    catch (_) { enabled = false; enabledInput.checked = false; }
    setStatus(enabled ? "স্মৃতি চালু হয়েছে; প্রাসঙ্গিক স্মৃতি উত্তরে ব্যবহার হতে পারে।" : "স্মৃতি বন্ধ; আগের স্মৃতি থাকবে কিন্তু নতুন করে সংরক্ষণ বা উত্তরে ব্যবহার হবে না।");
    await refresh();
  });
  section.addEventListener("click", async event => {
    const button = event.target.closest("button[data-memory]");
    if (!button) return;
    try {
      if (button.dataset.memory === "search") await search();
      if (button.dataset.memory === "refresh") await refresh();
      if (button.dataset.memory === "export") {
        const data = JSON.stringify(await engine.exportAll(), null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = "mosharrof-memory-backup.json"; link.click(); URL.revokeObjectURL(url);
        setStatus("স্মৃতির ব্যাকআপ তৈরি হয়েছে।");
      }
      if (button.dataset.memory === "import") fileInput.click();
      if (button.dataset.memory === "clear") {
        if (!confirm("এই ডিভাইসের সব ব্যক্তিগত স্মৃতি স্থায়ীভাবে মুছবেন? আগে ব্যাকআপ নিলে পরে ফেরত আনতে পারবেন.")) return;
        await engine.clear(); await refresh(); setStatus("সব ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে।");
      }
    } catch (error) { setStatus("ব্যর্থ: " + (error.message || String(error))); }
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const result = await engine.importAll(JSON.parse(await file.text()));
      await refresh();
      setStatus("ব্যাকআপ ফেরত এসেছে · মোট " + result.count + "টি স্মৃতি");
    } catch (error) { setStatus("ব্যাকআপ ফেরত আনা যায়নি: " + (error.message || String(error))); }
    finally { fileInput.value = ""; }
  });
  queryInput.addEventListener("keydown", event => { if (event.key === "Enter") search().catch(() => {}); });
  folderInput.addEventListener("change", () => refresh().catch(() => {}));
  setup();
}
