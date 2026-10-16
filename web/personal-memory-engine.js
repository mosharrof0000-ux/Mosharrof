/**
 * MOSHARROF AI Personal Memory Engine (v1).
 * Browser-local persistence: unlimited by application policy, bounded by device/browser storage.
 * Memory is organized by topic and chronology, with current-chat context taking precedence.
 */
const DB_NAME = "mosharrof-personal-memory-v1";
const DB_VERSION = 1;
const STORE = "memories";
const PROFILE_KEY = "profile";
const MAX_CONTEXT_ITEMS = 12;
const MAX_CONTEXT_CHARS = 9000;

function cleanText(value, max = 12000) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, max);
}
function topicFor(text) {
  const t = String(text || "").toLowerCase();
  const groups = [
    ["mosharrof-ai", /mosharrof|মোশাররফ|worker|github|ডেপ্লয়|ডেপ্লয়|প্রোগ্রাম|কোড|অ্যাপ|এজেন্ট/],
    ["story-writing", /গল্প|উপন্যাস|কাহিনি|story|novel|fiction|কবিতা|poem/],
    ["quran-research", /কোরআন|কুরআন|quran|তাফসির|আয়াত|আয়াত|আরবি/],
    ["voice-audio", /কণ্ঠ|ভয়েস|ভয়েস|tts|অডিও|শব্দ করে|পড়ে শোনাও|পড়ে শোনাও/],
    ["android-automation", /অ্যান্ড্রয়েড|অ্যান্ড্রয়েড|android|automation|ডিভাইস নিয়ন্ত্রণ|ডিভাইস নিয়ন্ত্রণ/],
    ["writing-preferences", /সংক্ষিপ্ত|বিস্তারিত|দীর্ঘ|ছোট করে|লম্বা করে|শব্দের|ওয়ার্ড|ওয়ার্ড|word count/],
    ["personal-preferences", /আমি পছন্দ|আমার পছন্দ|আমাকে মনে|আমার জন্য|আমি চাই|আমার নির্দেশ/]
  ];
  for (const [topic, pattern] of groups) if (pattern.test(t)) return topic;
  return "general";
}
function normalizeDbRequest(request) {
  const result = request.result;
  if (!result.objectStoreNames.contains(STORE)) result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
}
function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("indexeddb_unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => normalizeDbRequest(request);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("memory_db_open_failed"));
  });
}
function transaction(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let output;
    try { output = work(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(output && typeof output.then === "function" ? output : output);
    tx.onerror = () => reject(tx.error || new Error("memory_transaction_failed"));
    tx.onabort = () => reject(tx.error || new Error("memory_transaction_aborted"));
  });
}
function getAll(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("memory_read_failed"));
  });
}
function put(db, item) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("memory_write_failed"));
  });
}
function remove(db, id) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("memory_delete_failed"));
  });
}
function profileDefaults() {
  return { version: 1, preferences: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
async function readProfile(db) {
  const all = await getAll(db);
  return all.find(item => item.kind === "profile") || { ...profileDefaults(), id: PROFILE_KEY, kind: "profile" };
}
async function writeProfile(db, profile) {
  profile.updatedAt = new Date().toISOString();
  await put(db, profile);
  return profile;
}
function terms(text) {
  return Array.from(new Set(cleanText(text, 4000).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []))
    .filter(word => !/^(একটা|একটি|আমাকে|করুন|করো|দিয়ে|দিয়ে|থেকে|যেন|এবং|তাহলে|please|write|make|with|that|this|what|when|where|have|your|about|from|into|then|them|they|would|could|should)$/i.test(word));
}
function score(item, queryTerms, currentTopic) {
  const haystack = (item.topic + " " + item.content + " " + (item.tags || []).join(" ")).toLowerCase();
  let points = item.topic === currentTopic ? 3 : 0;
  for (const word of queryTerms) if (haystack.includes(word)) points += 2;
  const ageDays = Math.max(0, (Date.now() - Date.parse(item.updatedAt || item.createdAt || 0)) / 86400000);
  points += Math.max(0, 1 - ageDays / 180);
  return points;
}
function buildProfileSummary(profile) {
  const entries = Object.entries(profile.preferences || {}).filter(([, value]) => value && value.value);
  if (!entries.length) return "";
  return "Learned user preferences (tentative; current request overrides): " +
    entries.map(([key, value]) => key + ": " + value.value).join("; ");
}
export async function createPersonalMemoryEngine() {
  const db = await openDb();
  return {
    async rememberMessage(text, options = {}) {
      const content = cleanText(text);
      if (content.length < 8) return { stored: false, reason: "too_short" };
      const topic = options.topic || topicFor(content);
      const all = await getAll(db);
      const normalized = content.toLowerCase().replace(/\s+/g, " ");
      const duplicate = all.find(item => item.kind === "memory" && item.content.toLowerCase().replace(/\s+/g, " ") === normalized);
      if (duplicate) {
        duplicate.lastSeenAt = new Date().toISOString();
        duplicate.updatedAt = duplicate.lastSeenAt;
        duplicate.occurrences = (duplicate.occurrences || 1) + 1;
        await put(db, duplicate);
        return { stored: true, duplicate: true, id: duplicate.id, topic };
      }
      const now = new Date().toISOString();
      const item = {
        kind: "memory", topic, content, tags: options.tags || terms(content).slice(0, 16),
        source: options.source || "chat", confidence: options.confidence || 0.55,
        createdAt: now, updatedAt: now, lastSeenAt: now, occurrences: 1,
        importance: options.importance || "normal"
      };
      const id = await put(db, item);
      return { stored: true, id, topic };
    },
    async relevantMemories(query, limit = MAX_CONTEXT_ITEMS) {
      const all = await getAll(db);
      const q = cleanText(query, 5000);
      const queryTerms = terms(q);
      const topic = topicFor(q);
      return all.filter(item => item.kind === "memory")
        .map(item => ({ item, rank: score(item, queryTerms, topic) }))
        .filter(row => row.rank > 0.5)
        .sort((a, b) => b.rank - a.rank || String(b.item.updatedAt).localeCompare(String(a.item.updatedAt)))
        .slice(0, Math.max(1, limit))
        .map(row => row.item);
    },
    async buildContext(query) {
      const [profile, memories] = await Promise.all([readProfile(db), this.relevantMemories(query)]);
      const current = cleanText(query, 6000);
      const chunks = [];
      const profileText = buildProfileSummary(profile);
      if (profileText) chunks.push(profileText);
      if (memories.length) chunks.push("Relevant prior memories (use only if helpful; current conversation/request takes priority; do not force unrelated past context):\n" +
        memories.map((m, i) => (i + 1) + ". [" + m.topic + "] " + m.content).join("\n"));
      if (current) chunks.push("Current request (highest priority):\n" + current);
      let result = chunks.join("\n\n");
      if (result.length > MAX_CONTEXT_CHARS) result = result.slice(-MAX_CONTEXT_CHARS);
      return result;
    },
    async learnPreference(key, value, options = {}) {
      const cleanKey = cleanText(key, 80);
      const cleanValue = cleanText(value, 500);
      if (!cleanKey || !cleanValue) return { stored: false, reason: "missing_key_or_value" };
      const profile = await readProfile(db);
      profile.preferences[cleanKey] = { value: cleanValue, confidence: options.confidence || 0.65, source: options.source || "user-feedback", updatedAt: new Date().toISOString() };
      await writeProfile(db, profile);
      return { stored: true, key: cleanKey };
    },
    async getProfile() { return readProfile(db); },
    async stats() {
      const all = await getAll(db);
      const memories = all.filter(item => item.kind === "memory");
      return { total: memories.length, topics: [...new Set(memories.map(item => item.topic))].length, folders: [...new Set(memories.map(item => item.topic))].sort() };
    },
    async forgetAll() {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("memory_clear_failed"));
      });
      return { cleared: true };
    },
    async forget(id) { return remove(db, id); }
  };
}
