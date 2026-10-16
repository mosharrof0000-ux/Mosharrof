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
function inferPreferences(text) {
  const rules = [];
  if (/(ছোট করে|সংক্ষেপে|সংক্ষিপ্ত উত্তর|briefly|keep it short)/i.test(text)) rules.push({ key: "response_length", value: "short when not otherwise specified" });
  if (/(বিস্তারিত|খুঁটিনাটি|খুলে বল|বড় করে|বড় করে|দীর্ঘ|long-form|in detail)/i.test(text)) rules.push({ key: "response_length", value: "detailed when the request implies depth" });
  if (/(গল্প|উপন্যাস|story|novel)/i.test(text) && /(আরও বড়|আরও বড়|দীর্ঘ|বিস্তারিত|বড় গল্প|বড় গল্প|long|more detail)/i.test(text)) rules.push({ key: "story_style", value: "prefers fuller story development when requested" });
  if (/(মনে রাখ|পরের বার|আগামীতে|সবসময়|সর্বদা|আমার পছন্দ|remember this|next time)/i.test(text)) rules.push({ key: "explicit_preference", value: text.slice(0, 500) });
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
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 12).map(x => String(x).slice(0, 40)) : [],
      previousId: input.previousId || null,
      preferences: input.kind === "user" ? inferPreferences(text) : []
    };
    if (adapter) await adapter.add(row); else await transaction("readwrite", s => s.add(row));
    for (const pref of row.preferences) {
      const learned = {
        id: makeId(), kind: "preference", text: pref.key + ": " + pref.value,
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
    if (!enabled()) return [];
    const q = new Set(tokenize(query));
    const rows = await allRows();
    return rows.map(row => {
      const words = tokenize(row.text);
      let overlap = 0;
      for (const word of words) if (q.has(word)) overlap += 1;
      const recency = Math.max(0, 1 - (now() - row.createdAt) / (365 * 86400000));
      const preferenceBoost = row.kind === "preference" ? 0.45 : 0;
      return { ...row, score: overlap / Math.max(1, q.size) + recency * 0.08 + preferenceBoost };
    }).filter(row => row.kind === "preference" || row.score > 0.05)
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
    const selected = memories.filter(row => row.kind !== "preference").slice(-7)
      .concat(Array.from(latestPreferences.values()))
      .sort((a, b) => a.sequence - b.sequence);
    return "PERSONAL MEMORY, OLDEST TO NEWEST (past user-provided context; may be incomplete or stale; current request overrides it):\n" +
      selected.map(row => "[" + row.isoTime + " · " + row.kind + "] " + row.text.slice(0, 700)).join("\n");
  }
  async function list(limit = 100) {
    const rows = await allRows();
    return rows.sort((a, b) => a.sequence - b.sequence)
      .slice(-Math.max(1, Math.min(500, Number(limit) || 100)))
      .map(({ id, kind, text, createdAt, isoTime, sessionId, sequence, tags, previousId }) =>
        ({ id, kind, text, createdAt, isoTime, sessionId, sequence, tags, previousId }));
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
  return Object.freeze({ add, recall, buildContext, list, clear, enabled, setEnabled });
}
