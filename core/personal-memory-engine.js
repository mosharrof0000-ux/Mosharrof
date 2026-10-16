/* MOSHARROF Personal Memory Engine
 * Local-first, append-only timeline with bounded retrieval. No fixed entry cap;
 * actual persistence remains subject to the browser/device's available storage quota.
 */
const SECRET_PATTERN = /(password|passcode|one[- ]time password|\botp\b|\bcvv\b|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর)/i;
const STOP = new Set(["আমি","আমার","তুমি","আপনি","এটা","সেটা","করে","করুন","করতে","হবে","হয়","হয়","যেন","যেটা","যে","কি","কী","একটা","একটি","এবং","the","this","that","with","from","have","want","please","make","can","will","your","you","for","and"]);
function tokens(value) {
  return String(value || "").toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu)?.filter(t => !STOP.has(t)) || [];
}
function safeText(value, max = 12000) {
  return String(value || "").trim().slice(0, max);
}
function score(query, record) {
  const q = new Set(tokens(query));
  if (!q.size) return 0;
  const haystack = tokens([record.userText, record.assistantExcerpt, record.summary, ...(record.tags || [])].join(" "));
  if (!haystack.length) return 0;
  let hits = 0;
  for (const token of q) if (haystack.includes(token)) hits += 1;
  return hits / Math.sqrt(q.size * new Set(haystack).size);
}
function inferPreference(text) {
  const value = String(text || "").trim();
  const patterns = [
    { pattern: /(ছোট করে|সংক্ষেপে|সংক্ষিপ্ত উত্তর|আরও ছোট|কম কথায়|কম কথায়)/i, key: "response_length", value: "short", note: "ব্যবহারকারী ছোট/সংক্ষিপ্ত উত্তর চেয়েছেন" },
    { pattern: /(বিস্তারিত|খুলে বল|আরও বড়|আরও বড়|দীর্ঘ করে|পুরোটা বল|বড় করে|বড় করে)/i, key: "response_length", value: "detailed", note: "ব্যবহারকারী বিস্তারিত/দীর্ঘ উত্তর চেয়েছেন" },
    { pattern: /(মনে রাখ|স্মৃতিতে রাখ|পরের বার|পরবর্তীতে মনে)/i, key: "memory_instruction", value: "remember", note: "ব্যবহারকারী স্মৃতি ব্যবহারের স্পষ্ট নির্দেশ দিয়েছেন" },
    { pattern: /(বাংলায়|বাংলায়|বাংলা ভাষায়|বাংলা ভাষায়)/i, key: "language", value: "bn", note: "ব্যবহারকারী বাংলা ভাষা চেয়েছেন" }
  ];
  return patterns.filter(item => item.pattern.test(value)).map(item => ({ kind: "preference", key: item.key, value: item.value, summary: item.note }));
}
export function createIndexedDbMemoryStore(indexedDB, databaseName = "mosharrof-personal-memory-v1") {
  if (!indexedDB) throw new Error("এই ডিভাইসে IndexedDB পাওয়া যায়নি।");
  let opening;
  function db() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("timeline")) {
          const store = database.createObjectStore("timeline", { keyPath: "id" });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("kind", "kind", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("স্মৃতি ডেটাবেস খোলা যায়নি।"));
    });
    return opening;
  }
  function transact(mode, callback) {
    return db().then(database => new Promise((resolve, reject) => {
      const tx = database.transaction("timeline", mode);
      const request = callback(tx.objectStore("timeline"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("স্মৃতি সংরক্ষণ ব্যর্থ হয়েছে।"));
      tx.onabort = () => reject(tx.error || new Error("স্মৃতি অপারেশন বাতিল হয়েছে।"));
    }));
  }
  return Object.freeze({
    put: record => transact("readwrite", store => store.put(record)),
    list: () => transact("readonly", store => store.getAll()),
    delete: id => transact("readwrite", store => store.delete(id)),
    clear: () => transact("readwrite", store => store.clear())
  });
}
export function createPersonalMemoryEngine({ store, now = () => Date.now(), makeId = () => "mem-" + now().toString(36) + "-" + Math.random().toString(36).slice(2, 10), enabled = true } = {}) {
  if (!store || typeof store.put !== "function" || typeof store.list !== "function") throw new TypeError("একটি persistent memory store প্রয়োজন।");
  let active = enabled === true;
  async function add(entry) {
    if (!active) return { saved: false, reason: "paused" };
    const record = { id: makeId(), createdAt: now(), schemaVersion: 1, status: "active", ...entry };
    await store.put(record);
    return { saved: true, id: record.id, createdAt: record.createdAt };
  }
  async function rememberTurn({ userText, assistantText = "", sessionId = "" } = {}) {
    if (!active) return { saved: false, reason: "paused" };
    const user = safeText(userText), answer = safeText(assistantText, 2400);
    if (!user || SECRET_PATTERN.test(user) || SECRET_PATTERN.test(answer)) return { saved: false, reason: "sensitive_or_empty" };
    const tags = [...new Set(tokens(user).slice(0, 16))];
    const saved = await add({ kind: "conversation", sessionId: safeText(sessionId, 120), userText: user, assistantExcerpt: answer, summary: user.slice(0, 320), tags });
    const preferences = inferPreference(user);
    const profileResults = [];
    for (const preference of preferences) {
      const rows = await store.list();
      const previous = rows.filter(row => row.kind === "preference" && row.key === preference.key && row.status === "active");
      for (const old of previous) await store.put({ ...old, status: "superseded", supersededAt: now(), supersededBy: saved.id });
      profileResults.push(await add({ ...preference, sessionId: safeText(sessionId, 120), sourceMemoryId: saved.id, confidence: "explicit-language-cue" }));
    }
    return { saved: true, id: saved.id, preferenceCount: profileResults.filter(x => x.saved).length };
  }
  async function rememberFact({ text, kind = "note", tags = [], source = "user-approved", confidence = "user-stated" } = {}) {
    const value = safeText(text);
    if (!value || SECRET_PATTERN.test(value)) return { saved: false, reason: "sensitive_or_empty" };
    return add({ kind, summary: value, userText: value, tags: Array.isArray(tags) ? tags.map(String).slice(0, 20) : [], source, confidence });
  }
  async function retrieve(query, { limit = 8, maxChars = 4200 } = {}) {
    if (!active) return [];
    const rows = await store.list();
    const current = safeText(query, 3000);
    return rows.filter(row => row.status !== "superseded" && row.kind !== "system")
      .map(row => ({ row, relevance: score(current, row) }))
      .sort((a, b) => b.relevance - a.relevance || b.row.createdAt - a.row.createdAt)
      .filter(item => item.relevance > 0)
      .slice(0, Math.max(1, Math.min(Number(limit) || 8, 20)))
      .map(item => ({ ...item.row, relevance: Number(item.relevance.toFixed(3)) }))
      .reduce((result, row) => {
        const line = JSON.stringify({ date: new Date(row.createdAt).toISOString(), kind: row.kind, status: row.status, summary: row.summary || row.userText, userText: row.userText, assistantExcerpt: row.assistantExcerpt, confidence: row.confidence, relevance: row.relevance });
        if (result.length < maxChars && result.join("\n").length + line.length <= maxChars) result.push(line);
        return result;
      }, []);
  }
  async function buildContext(query, options = {}) {
    const memories = await retrieve(query, options);
    const currentProfile = await profile();
    const preferenceLines = currentProfile.preferences.map(item => JSON.stringify({
      kind: "active_preference", key: item.key, value: item.value,
      summary: item.summary, date: new Date(item.createdAt).toISOString(),
      confidence: item.confidence
    }));
    const lines = [...preferenceLines, ...memories];
    if (!lines.length) return "";
    return "PERSONAL MEMORY (local saved timeline; context, not guaranteed truth):\\n" +
      lines.join("\\n").slice(0, options.maxChars || 4200) +
      "\\nUse dated memories to infer continuity and the user's likely preference cautiously. Prefer newer explicit statements when preferences conflict. Separate user-stated facts from interpretations; never claim certainty about unstated thoughts.";
  }
  async function timeline({ limit = 100 } = {}) {
    const rows = await store.list();
    return rows.sort((a, b) => a.createdAt - b.createdAt).slice(-Math.max(1, Number(limit) || 100));
  }
  async function profile() {
    const rows = await store.list();
    const activePreferences = rows.filter(row => row.kind === "preference" && row.status === "active");
    return { enabled: active, totalEntries: rows.length, conversationCount: rows.filter(row => row.kind === "conversation").length, preferenceCount: activePreferences.length, preferences: activePreferences.map(({ key, value, summary, createdAt, confidence }) => ({ key, value, summary, createdAt, confidence })) };
  }
  async function clear() {
    if (typeof store.clear !== "function") throw new Error("এই store-এ পরিষ্কার করার সুবিধা নেই।");
    const before = (await store.list()).length;
    await store.clear();
    return { cleared: before };
  }
  function setEnabled(value) { active = value === true; return active; }
  return Object.freeze({ rememberTurn, rememberFact, retrieve, buildContext, timeline, profile, clear, setEnabled, get enabled() { return active; } });
}
