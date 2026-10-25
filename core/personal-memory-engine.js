/* MOSHARROF personal memory engine.
 * Local-first chronological memory. No application-level entry cap; browser quota still applies.
 * Stores only on-device and excludes obvious credentials / high-risk secrets.
 */
const DB_NAME = "mosharrof-personal-memory-v1";
const STORE_NAME = "entries";
const PREF_KEY = "mosharrof.personal-memory.enabled.v1";
const SECRET = /(password|passcode|\botp\b|verification code|credit card|debit card|cvv|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|সিভিভি)/i;
const SENSITIVE = /(diagnos(ed|is)|medical record|sexual|sex life|political party|religion|জাতীয় পরিচয়পত্র|জাতীয় পরিচয়পত্র|রোগ নির্ণয়|রোগ নির্ণয়|যৌন জীবন)/i;

function openDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Personal memory database unavailable"));
  });
}
function tokenize(value) {
  return String(value || "").toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [];
}
function safeText(value, limit = 2400) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || SECRET.test(text) || SENSITIVE.test(text)) return "";
  return text.slice(0, limit);
}
const TOPIC_FOLDERS = [
  { id: "memory-learning", label: "স্মৃতি ও শেখা", pattern: /(স্মৃতি|মেমোরি|memory|শিখতে|শেখা|বুদ্ধিমত্তা|personal learning)/i },
  { id: "projects", label: "প্রকল্প ও প্রযুক্তি", pattern: /(mosharrof|মোশাররফ|প্রজেক্ট|প্রকল্প|কোড|github|অ্যাপ|সার্ভার|api|android|অ্যান্ড্রয়েড|automation|অটোমেশন|worker|deploy|ডেপ্লয়)/i },
  { id: "writing", label: "লেখালেখি ও গল্প", pattern: /(গল্প|উপন্যাস|কবিতা|প্রবন্ধ|লেখা|লিখে|শব্দের|words?|story|novel|poem|article|writing)/i },
  { id: "quran-research", label: "কুরআন ও গবেষণা", pattern: /(কুরআন|কোরআন|আয়াত|আয়াত|সূরা|তাফসির|তাফসীর|quran|research|গবেষণা|আরবি|ব্যাকরণ)/i },
  { id: "preferences", label: "পছন্দ ও আচরণ", pattern: /(আমার পছন্দ|মনে রাখ|পরের বার|সবসময়|সব সময়|সংক্ষিপ্ত|বিস্তারিত|ছোট করে|বড় করে|বড় করে|i prefer|remember|next time|always)/i },
  { id: "plans", label: "পরিকল্পনা ও লক্ষ্য", pattern: /(পরিকল্পনা|লক্ষ্য|ভবিষ্যতে|পরবর্তীতে|করব|করতে চাই|বাকি কাজ|পরবর্তী ধাপ|plan|goal|future|next step)/i }
];
function inferFolder(text, kind = "user") {
  if (kind === "preference") return TOPIC_FOLDERS.find(folder => folder.id === "preferences");
  const value = String(text || "");
  for (const folder of TOPIC_FOLDERS) if (folder.pattern.test(value)) return { id: folder.id, label: folder.label };
  return { id: "general", label: "কথোপকথন ও অন্যান্য" };
}
function inferPreferences(text) {
  const rules = [];
  if (/(ছোট করে|সংক্ষেপে|সংক্ষিপ্ত উত্তর|briefly|keep it short)/i.test(text)) rules.push({ key: "response_length", value: "short when not otherwise specified" });
  if (/(বিস্তারিত|খুঁটিনাটি|খুলে বল|বড় করে|বড় করে|দীর্ঘ|long-form|in detail)/i.test(text)) rules.push({ key: "response_length", value: "detailed when the request implies depth" });
  if (/(গল্প|উপন্যাস|story|novel)/i.test(text) && /(আরও বড়|আরও বড়|দীর্ঘ|বিস্তারিত|বড় গল্প|বড় গল্প|long|more detail)/i.test(text)) rules.push({ key: "story_style", value: "prefers fuller story development when requested" });
  if (/(মনে রাখ|স্মৃতিতে রাখ|পরের বার|আগামীতে|সবসময়|সর্বদা|আমার পছন্দ|remember this|next time)/i.test(text)) rules.push({ key: "explicit_preference", value: text.slice(0, 500) });
  if (/(ফোল্ডার|বিষয়ভিত্তিক|বিষয়ভিত্তিক|গুছিয়ে|গুছিয়ে|ধাপে ধাপে|chronological|topic-based|folder)/i.test(text)) rules.push({ key: "memory_organization", value: "organize memories by topic and chronology" });
  if (/(বর্তমানকে|বর্তমান কথ|বর্তমান চ্যাট|অতীতকে চাপিয়ে|অতীতকে চাপিয়ে|current.*past|current request|present first)/i.test(text)) rules.push({ key: "context_priority", value: "current request takes priority over old memories" });
  if (/(ভবিষ্যতে|আগে পরে|পরবর্তী কথা|কি হতে পারে|কী হতে পারে|next step|future|likely follow-up)/i.test(text)) rules.push({ key: "future_planning", value: "consider likely next steps cautiously" });
  return rules;
}

export function createPersonalMemoryEngine(options = {}) {
  const root = options.root || globalThis;
  const indexedDB = options.indexedDB || root.indexedDB;
  const adapter = options.adapter || null;
  const now = options.now || (() => Date.now());
  const makeId = options.makeId || (() => root.crypto?.randomUUID?.() || "memory-" + now().toString(36) + "-" + Math.random().toString(36).slice(2, 9));
  let databasePromise;
  function enabled() {
    try {
      const value = root.localStorage?.getItem(PREF_KEY);
      return value === null || value === undefined ? true : value === "true";
    } catch { return true; }
  }
  async function store() {
    if (!indexedDB) throw new Error("IndexedDB unavailable");
    if (!databasePromise) databasePromise = openDatabase(indexedDB);
    return databasePromise;
  }
  async function transaction(mode, fn) {
    const db = await store();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const objectStore = tx.objectStore(STORE_NAME);
      let result;
      try { result = fn(objectStore); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error || new Error("Memory transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("Memory transaction aborted"));
    });
  }
  async function add(input) {
    if (!enabled()) return { stored: false, reason: "disabled" };
    const text = safeText(input?.text, input?.kind === "user" ? 2400 : 4000);
    if (!text) return { stored: false, reason: "filtered_or_empty" };
    const createdAt = now();
    const row = {
      id: makeId(), kind: input.kind === "assistant" ? "assistant" : "user",
      text, createdAt, isoTime: new Date(createdAt).toISOString(),
      sessionId: String(input.sessionId || "default").slice(0, 100),
      sequence: Number.isFinite(input.sequence) ? input.sequence : createdAt,
      tags: [...new Set([...(Array.isArray(input.tags) ? input.tags.slice(0, 12).map(x => String(x).slice(0, 40)) : []), inferFolder(text, input.kind).id])],
      folder: input.folder || inferFolder(text, input.kind),
      previousId: input.previousId || null,
      preferences: input.kind === "user" ? inferPreferences(text) : []
    };
    if (adapter) await adapter.add(row); else await transaction("readwrite", s => s.add(row));
    for (const pref of row.preferences) {
      const learned = {
        id: makeId(), kind: "preference", folder: inferFolder("আমার পছন্দ " + pref.key), text: pref.key + ": " + pref.value,
        createdAt, isoTime: row.isoTime, sessionId: row.sessionId, sequence: row.sequence,
        tags: ["learned-preference", pref.key], previousId: row.id, preferences: [pref]
      };
      if (adapter) await adapter.add(learned); else await transaction("readwrite", s => s.add(learned));
    }
    return { stored: true, id: row.id, createdAt };
  }
  async function allRows() {
    if (adapter) return await adapter.list();
    const db = await store();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Could not read personal memories"));
    });
  }
  async function recall(query, limit = 8) {
    // An empty query is not a follow-up; never return unrelated memories by default.
    if (!String(query || "").trim() || !enabled()) return [];
    const q = new Set(tokenize(query));
    const queryFolder = inferFolder(query);
    const followup = /(এটা|সেটা|ওটা|আগের|চালিয়ে|চালিয়ে|আরও|তারপর|ওই|continue|that|it|previous|earlier|next|same)/i.test(query) || q.size < 2;
    const rows = await allRows();
    return rows.map(row => {
      const words = tokenize([row.text, row.folder?.label || row.folder, ...(row.tags || [])].join(" "));
      let overlap = 0;
      for (const word of words) if ([...q].some(term => term === word || term.startsWith(word) || word.startsWith(term))) overlap += 1;
      const recency = Math.max(0, 1 - (now() - row.createdAt) / (365 * 86400000));
      const key = row.preferences?.[0]?.key || row.tags?.[1] || "";
      const globalPreference = row.kind === "preference" && ["response_length","explicit_preference","memory_organization","context_priority","future_planning"].includes(key);
      const topicPreference = row.kind === "preference" && ["story_style"].includes(key) && queryFolder.id === "writing";
      const preferenceBoost = row.kind === "preference" && (globalPreference || topicPreference) ? 0.45 : 0;
      const score = overlap / Math.max(1, q.size) + recency * 0.08 + preferenceBoost + (row.folder?.id === queryFolder.id ? 0.22 : 0);
      return { ...row, score, overlap, relevantPreference: globalPreference || topicPreference };
    }).filter(row => row.overlap > 0 || row.relevantPreference || (followup && row.score > 0.05))
      .sort((a, b) => b.score - a.score || a.sequence - b.sequence)
      .slice(0, Math.max(1, Math.min(16, Number(limit) || 8)));
  }
  async function buildContext(query) {
    const memories = await recall(query, 16);
    if (!memories.length) return "";
    const latestPreferences = new Map();
    for (const row of memories.slice().sort((a, b) => a.sequence - b.sequence)) {
      if (row.kind === "preference") {
        const key = row.preferences?.[0]?.key || row.tags?.[1] || row.id;
        latestPreferences.set(key, row);
      }
    }
    const selected = memories.filter(row => row.kind !== "preference").slice(0, 7)
      .concat(Array.from(latestPreferences.values()))
      .sort((a, b) => a.sequence - b.sequence);
    return "PERSONAL MEMORY, OLDEST TO NEWEST (past user-provided context; may be incomplete or stale; current request overrides it):\n" +
      selected.map(row => "[" + (row.folder?.label || row.folder || "সাধারণ কথোপকথন") + " · " + row.isoTime + " · " + row.kind + "] " + row.text.slice(0, 700)).join("\n");
  }
  async function list(limit = 100) {
    const rows = await allRows();
    return rows.sort((a, b) => a.sequence - b.sequence)
      .slice(-Math.max(1, Math.min(500, Number(limit) || 100)));
  }
  async function listFolder(folderId, limit = 100) {
    const rows = await allRows();
    return rows.filter(row => row.folder?.id === folderId)
      .sort((a, b) => a.sequence - b.sequence)
      .slice(-Math.max(1, Math.min(500, Number(limit) || 100)));
  }
  async function folders() {
    const rows = await allRows();
    const counts = new Map();
    for (const row of rows) {
      const folder = row.folder || inferFolder(row.text);
      const current = counts.get(folder.id) || { id: folder.id, label: folder.label, count: 0, latestAt: 0 };
      current.count += 1;
      current.latestAt = Math.max(current.latestAt, Number(row.createdAt) || 0);
      counts.set(folder.id, current);
    }
    return Array.from(counts.values()).sort((a, b) => b.latestAt - a.latestAt);
  }
  async function search(query, limit = 100) {
    const q = new Set(tokenize(query));
    const rows = await allRows();
    return rows.map(row => {
      const words = tokenize([row.text, row.folder?.label || row.folder, ...(row.tags || [])].join(" "));
      const overlap = words.reduce((n, word) => n + (q.has(word) ? 1 : 0), 0);
      return { ...row, relevance: overlap / Math.max(1, q.size) };
    }).filter(row => row.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || b.createdAt - a.createdAt)
      .slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
  }
  async function exportAll() {
    return { schemaVersion: 1, exportedAt: new Date(now()).toISOString(), entries: await allRows() };
  }
  async function importAll(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.entries)) throw new TypeError("Unsupported memory export.");
    const existing = new Set((await allRows()).map(row => row.id));
    let imported = 0;
    for (const row of snapshot.entries) {
      if (!row || !row.id || existing.has(row.id) || !safeText(row.text)) continue;
      const restored = { ...row, folder: row.folder || inferFolder(row.text) };
      if (adapter) await adapter.add(restored); else await transaction("readwrite", s => s.put(restored));
      existing.add(row.id);
      imported += 1;
    }
    return { imported };
  }
  async function timeline(limit = 100) {
    const rows = await allRows();
    return rows.sort((a, b) => a.sequence - b.sequence)
      .slice(-Math.max(1, Math.min(1000, Number(limit) || 100)));
  }
  async function clear() {
    if (adapter) { await adapter.clear(); return { cleared: true }; }
    const db = await store();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const request = tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve({ cleared: true });
      tx.onerror = () => reject(request.error || new Error("Could not clear personal memory"));
    });
  }
  function setEnabled(value) {
    try { root.localStorage?.setItem(PREF_KEY, value ? "true" : "false"); }
    catch { /* private browsing may deny preferences; memory remains local */ }
    return !!value;
  }
  return Object.freeze({ add, recall, buildContext, list, listFolder, folders, search, exportAll, importAll, timeline, classifyFolder: inferFolder, clear, enabled, setEnabled });
}
