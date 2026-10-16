import {
  createIndexedDbMemoryStore, createPersonalMemoryEngine,
  buildPersonalMemoryContext
} from "./personal-memory-engine.js";

const CONSENT_KEY = "mosharrof-personal-memory-enabled-v1";
const CHAT_URL = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/chat";
let initialized = false;

export function initializePersonalMemory() {
  if (initialized || typeof window === "undefined" || !window.document) return;
  initialized = true;
  const nav = document.getElementById("navR");
  if (!nav || document.getElementById("personalMemoryPanel")) return;
  const section = document.createElement("section");
  section.className = "nav-family";
  section.id = "personalMemoryPanel";
  section.innerHTML =
    '<div class="nav-family-title"><span aria-hidden="true">▤</span><span>ব্যক্তিগত স্মৃতি ইঞ্জিন</span></div>' +
    '<p>বিষয়ভিত্তিক স্মৃতি এই ডিভাইসের IndexedDB-তে থাকবে। উত্তরের জন্য প্রাসঙ্গিক স্মৃতির অংশ AI সার্ভারে পাঠানো হতে পারে। ডিভাইসের স্টোরেজ সীমা প্রযোজ্য।</p>' +
    '<label><input type="checkbox" data-memory="enabled"> ব্যক্তিগত স্মৃতি চালু</label>' +
    '<div class="audio-setting-row"><input type="search" data-memory="query" placeholder="বিষয় বা স্মৃতি খুঁজুন" aria-label="স্মৃতি খুঁজুন">' +
    '<select data-memory="folder" aria-label="স্মৃতির ফোল্ডার"><option value="">সব বিষয়</option>' +
    '<option>ব্যক্তিগত পছন্দ</option><option>লক্ষ্য ও পরিকল্পনা</option><option>প্রকল্প ও প্রযুক্তি</option>' +
    '<option>সংশোধন ও শেখা</option><option>গবেষণা ও জ্ঞান</option><option>সময়রেখা ও ঘটনা</option><option>সাধারণ কথোপকথন</option></select></div>' +
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
  const savedSetting = () => { try { return localStorage.getItem(CONSENT_KEY); } catch (_) { return null; } };

  function setStatus(text) { status.textContent = text; }
  async function setup() {
    try {
      const store = createIndexedDbMemoryStore(window.indexedDB);
      engine = createPersonalMemoryEngine({ store });
      const setting = savedSetting();
      enabled = setting === "enabled";
      enabledInput.checked = enabled;
      if (setting === null) localStorage.setItem(CONSENT_KEY, "disabled");
      setStatus(enabled ? "স্মৃতি চালু · এই ডিভাইসে সংরক্ষণ হচ্ছে" : "স্মৃতি বন্ধ · নতুন কিছু সংরক্ষণ হবে না");
      await refresh();
    } catch (error) {
      enabledInput.checked = false;
      enabled = false;
      setStatus("মেমোরি চালু করা যায়নি: " + (error.message || String(error)));
    }
  }
  async function refresh() {
    if (!engine) return;
    const folder = folderInput.value || undefined;
    const result = await engine.all({ folder, limit: 40, includeArchived: false });
    showRows(result.items);
    setStatus((enabled ? "স্মৃতি চালু" : "স্মৃতি বন্ধ") + " · " + result.total + "টি মেমোরি · বিষয়ভিত্তিক ফোল্ডার · কোনো অ্যাপ-নির্ধারিত মোট এন্ট্রি সীমা নেই");
  }
  function showRows(rows) {
    results.textContent = "";
    if (!rows.length) { results.textContent = "এই ফোল্ডারে এখনো স্মৃতি নেই।"; return; }
    rows.forEach(function (item) {
      const row = document.createElement("div");
      row.className = "device-quick-actions";
      const label = document.createElement("div");
      label.textContent = "📁 " + item.folder + " · " + new Date(item.created_at).toLocaleString() + "\n" + item.content.slice(0,360);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "ভুলে যান";
      remove.addEventListener("click", async function () {
        if (!confirm("এই স্মৃতিটি মুছে ফেলবেন?")) return;
        await engine.forget(item.id);
        await refresh();
      });
      row.append(label, remove);
      results.appendChild(row);
    });
  }
  async function search() {
    if (!engine || !enabled) { setStatus("স্মৃতি চালু করুন, তারপর খুঁজুন।"); return; }
    const query = queryInput.value.trim();
    if (!query) { await refresh(); return; }
    const result = await engine.recall({ query, folder: folderInput.value || undefined, limit: 40 });
    showRows(result.items);
    setStatus("মিল পাওয়া গেছে: " + result.items.length + "টি · মোট মিলে যাওয়া " + result.total);
  }

  enabledInput.addEventListener("change", async function () {
    enabled = enabledInput.checked;
    try { localStorage.setItem(CONSENT_KEY, enabled ? "enabled" : "disabled"); }
    catch (_) { enabled = false; enabledInput.checked = false; }
    setStatus(enabled ? "স্মৃতি চালু হয়েছে। প্রাসঙ্গিক স্মৃতি উত্তরে ব্যবহার হতে পারে।" : "স্মৃতি বন্ধ হয়েছে; আগের স্মৃতি এই ডিভাইসে থাকবে, ব্যবহার হবে না।");
    await refresh();
  });
  section.addEventListener("click", async function (event) {
    const button = event.target.closest("button[data-memory]");
    if (!button) return;
    const action = button.dataset.memory;
    try {
      if (action === "search") await search();
      if (action === "refresh") await refresh();
      if (action === "export") {
        const data = await engine.exportAll();
        const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = "mosharrof-memory-backup.json"; link.click(); URL.revokeObjectURL(url);
        setStatus("স্মৃতির ব্যাকআপ তৈরি হয়েছে।");
      }
      if (action === "import") fileInput.click();
      if (action === "clear") {
        if (!confirm("এই ডিভাইসের সব ব্যক্তিগত স্মৃতি স্থায়ীভাবে মুছবেন? আগে ব্যাকআপ নিলে পরে ফেরত আনতে পারবেন।")) return;
        await engine.clear(); await refresh(); setStatus("সব ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে।");
      }
    } catch (error) { setStatus("ব্যর্থ: " + (error.message || String(error))); }
  });
  fileInput.addEventListener("change", async function () {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try { const result = await engine.importAll(JSON.parse(await file.text())); await refresh(); setStatus("ব্যাকআপ থেকে " + result.imported + "টি স্মৃতি ফেরত এসেছে।"); }
    catch (error) { setStatus("ব্যাকআপ ফেরত আনা যায়নি: " + (error.message || String(error))); }
    finally { fileInput.value = ""; }
  });
  queryInput.addEventListener("keydown", event => { if (event.key === "Enter") search().catch(() => {}); });
  folderInput.addEventListener("change", () => refresh().catch(() => {}));
  setup();
}
