/* MOSHARROF Personal Memory Engine.
 * Browser-local, topic-organized memory with visible controls.
 * The application has no fixed record count; browser storage quota still applies.
 */
(function (root) {
  "use strict";
  const DB_NAME = "mosharrof-personal-memory-v1";
  const DB_VERSION = 1;
  const STORE = "memories";
  const ENABLED_KEY = "mosharrof.personal-memory.enabled.v1";
  const MAX_RECORD_TEXT = 1800;
  const MAX_CONTEXT_CHARS = 3000;
  const SESSION_KEY = "mosharrof_chat_sessions_v1";
  const ACTIVE_SESSION_KEY = "mosharrof_active_session_v1";
  const SECRET = /(password|passcode|\botp\b|verification code|secret key|api[_ -]?key|access token|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|cvv|private key)/i;
  const DONT_STORE = /(মনে রেখো না|মনে রাখবে না|ভুলে যাও|স্মৃতি মুছে|forget (this|that|it|this message)|do not remember|don't remember|do not save|don't save)/i;
  let opening = null;
  let panelOpen = false;

  function enabled() {
    try { return root.localStorage.getItem(ENABLED_KEY) !== "false"; }
    catch (_) { return true; }
  }
  function setEnabled(value) {
    try { root.localStorage.setItem(ENABLED_KEY, value ? "true" : "false"); } catch (_) {}
    updatePanel();
    return !!value;
  }
  function openDb() {
    if (!root.indexedDB) return Promise.reject(new Error("এই ব্রাউজারে IndexedDB সমর্থিত নয়।"));
    if (!opening) opening = new Promise(function (resolve, reject) {
      const req = root.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("topic", "topic", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { opening = null; reject(req.error || new Error("স্মৃতি ডেটাবেস খোলা যায়নি।")); };
    });
    return opening;
  }
  async function transact(mode, fn) {
    const db = await openDb();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE, mode);
      let request;
      try { request = fn(tx.objectStore(STORE)); }
      catch (error) { reject(error); return; }
      if (request && "onsuccess" in request) {
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { reject(request.error || new Error("স্মৃতি অপারেশন ব্যর্থ।")); };
      } else {
        tx.oncomplete = function () { resolve(true); };
      }
      tx.onabort = function () { reject(tx.error || new Error("স্মৃতি অপারেশন বাতিল হয়েছে।")); };
    });
  }
  function topicFor(text) {
    const s = String(text || "").toLowerCase();
    if (/(mosharrof|মোশাররফ|github|repo|প্রজেক্ট|প্রকল্প|কোড|ডেপ্লয়|deploy|worker|api|android|অ্যান্ড্রয়েড|অ্যাপ|automation|অটোমেশন)/i.test(s)) return "প্রকল্প ও প্রযুক্তি";
    if (/(গল্প|উপন্যাস|কবিতা|লেখা|লিখে|শব্দ|word count|article|story|writing|tone|ভাষা|বাংলা)/i.test(s)) return "লেখা ও ভাষা";
    if (/(কুরআন|quran|আয়াত|আয়াত|তাফসির|tafsir|research|গবেষণা)/i.test(s)) return "গবেষণা ও কুরআন";
    if (/(ভয়েস|ভয়েস|voice|tts|শুনতে|কণ্ঠ|audio|অডিও)/i.test(s)) return "কণ্ঠ ও অডিও";
    if (/(আমি চাই|আমার পছন্দ|আমি পছন্দ|আমার লক্ষ্য|আমার পরিকল্পনা|মনে রেখো|আমাকে বুঝ|আমার চিন্তা|i prefer|i want|my goal|my preference|remember that)/i.test(s)) return "পছন্দ ও লক্ষ্য";
    if (/(আগামী|পরে|পরবর্তীতে|বাকি আছে|পরের ধাপ|follow.?up|next step|পরিকল্পনা|deadline|সময়সীমা)/i.test(s)) return "সময়রেখা ও পরবর্তী কাজ";
    return "সাধারণ প্রসঙ্গ";
  }
  function kindFor(text) {
    if (/(আমি চাই|আমার পছন্দ|পছন্দ করি|মনে রেখো|সবসময়|সবসময়|i prefer|remember that|always)/i.test(text)) return "preference";
    if (/(করতে চাই|আমার লক্ষ্য|পরিকল্পনা|পরের ধাপ|বাকি আছে|next step|my goal|i plan to)/i.test(text)) return "goal";
    if (/(সংশোধন|ভুল হয়েছে|ভুল হয়েছে|আরও বড়|আরো বড়|ছোট কর|instead|actually|correction)/i.test(text)) return "correction";
    if (/(আগামী|গতকাল|আজ|আগে|পরে|পরবর্তীতে|deadline|তারিখ|সময়সীমা|সময়সীমা)/i.test(text)) return "timeline";
    if (/(mosharrof|মোশাররফ|github|repo|প্রজেক্ট|প্রকল্প|কোড|ডেপ্লয়|deploy|worker|api|android|অ্যান্ড্রয়েড|অ্যাপ|automation|অটোমেশন)/i.test(text)) return "project";
    return "episode";
  }
  function tagsFor(text, topic) {
    const tags = [topic];
    if (/(আমি চাই|আমার পছন্দ|i prefer|i want|my preference)/i.test(text)) tags.push("preference");
    if (/(করতে হবে|বাকি|পরবর্তী|next step|follow.?up|পরিকল্পনা)/i.test(text)) tags.push("follow-up");
    if (/(সংশোধন|ভুল|আরও বড়|আরো বড়|ছোট কর|change|instead|actually)/i.test(text)) tags.push("correction");
    if (/(মনে রেখো|remember that|always|সবসময়|সদাই)/i.test(text)) tags.push("explicit-memory");
    return Array.from(new Set(tags)).slice(0, 8);
  }
  function shouldRemember(text) {
    const s = String(text || "").trim();
    if (s.length < 12 || s.length > 12000 || SECRET.test(s) || DONT_STORE.test(s)) return false;
    if (/^(হাই|হ্যালো|ধন্যবাদ|ok|okay|হুম|yes|no|জি|না)[!.?। ]*$/i.test(s)) return false;
    return true;
  }
  function normalize(text) { return String(text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 500); }
  function idFor() {
    return "memory-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  async function remember(text, source) {
    if (!enabled() || !shouldRemember(text)) return null;
    const clean = String(text).trim().slice(0, MAX_RECORD_TEXT);
    const topic = topicFor(clean), kind = kindFor(clean), now = Date.now();
    if (kind === "preference" && /(এখন থেকে|আর চাই না|পরিবর্তন কর|instead|actually|from now on|change my preference)/i.test(clean)) {
      const prior = await transact("readonly", store => store.getAll());
      const words = new Set(tokens(clean));
      for (const item of prior) {
        if (item.status !== "active" || item.kind !== "preference" || item.topic !== topic) continue;
        const oldWords = tokens(item.text);
        if (oldWords.some(word => words.has(word))) {
          await transact("readwrite", store => store.put(Object.assign({}, item, { status: "superseded", updatedAt: now })));
        }
      }
    }
    const id = idFor(clean);
    const record = {
      id, topic, kind, folder: topic + "/" + kind, text: clean, tags: tagsFor(clean, topic),
      source: source || "current-chat-user-message",
      createdAt: now, updatedAt: now,
      status: "active", confidence: /মনে রেখো|remember that|আমার পছন্দ|i prefer/i.test(clean) ? 0.95 : 0.65
    };
    await transact("readwrite", store => store.put(record));
    updatePanel();
    return { id, topic };
  }
  function tokens(text) {
    return normalize(text).split(/\s+/).filter(t => t.length > 1).slice(0, 100);
  }
  function score(record, query) {
    const q = new Set(tokens(query));
    const r = new Set(tokens(record.text + " " + record.topic + " " + (record.tags || []).join(" ")));
    if (!q.size || !r.size) return 0;
    let hit = 0;
    q.forEach(t => { if (r.has(t)) hit += 1; });
    const overlap = hit / Math.sqrt(q.size * Math.max(1, r.size));
    const topicBonus = record.topic === topicFor(query) ? 0.22 : 0;
    const recency = Math.max(0, 0.08 * (1 - (Date.now() - record.updatedAt) / (180 * 86400000)));
    const confidence = Math.max(0, Math.min(1, Number(record.confidence) || 0.5)) * 0.08;
    return overlap + topicBonus + recency + confidence;
  }
  async function retrieve(query, limit) {
    if (!enabled() || !String(query || "").trim()) return [];
    const rows = await transact("readonly", store => store.getAll());
    const includeHistory = /(আগে|পুরোনো|ইতিহাস|previous|before|history)/i.test(String(query || ""));
    return rows.filter(row => row && (row.status === "active" || (includeHistory && row.status === "superseded")) )
      .map(row => ({ row, score: score(row, query) }))
      .filter(item => item.score >= 0.09)
      .sort((a, b) => b.score - a.score || b.row.updatedAt - a.row.updatedAt)
      .slice(0, Math.max(1, Math.min(Number(limit) || 8, 12)))
      .map(item => item.row);
  }
  async function contextFor(query) {
    const rows = await retrieve(query, 8);
    let remaining = MAX_CONTEXT_CHARS;
    const parts = [];
    for (const row of rows) {
      const line = "[" + row.topic + "; updated " + new Date(row.updatedAt).toISOString().slice(0, 10) + "] " + row.text.replace(/\s+/g, " ").trim();
      if (line.length > remaining) continue;
      parts.push(line); remaining -= line.length + 1;
    }
    return parts.join("\n");
  }
  async function list() {
    const rows = await transact("readonly", store => store.getAll());
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async function clear() {
    const rows = await list();
    await transact("readwrite", store => store.clear());
    updatePanel();
    return rows.length;
  }
  async function remove(id) {
    await transact("readwrite", store => store.delete(String(id || "")));
    updatePanel();
  }
  function downloadExport(rows) {
    const blob = new Blob([JSON.stringify({ schema: "mosharrof-memory-v1", exportedAt: new Date().toISOString(), memories: rows }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mosharrof-memory-export.json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function updatePanel() {
    const button = document.getElementById("mosharrof-memory-toggle");
    if (button) button.textContent = enabled() ? "🧠 স্মৃতি" : "🧠 স্মৃতি বন্ধ";
  }
  const api = Object.freeze({ enabled, setEnabled, remember, retrieve, contextFor, list, remove, clear, downloadExport });
  root.MosharrofMemoryEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
