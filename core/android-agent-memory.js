/* Local-first vector memory for MOSHARROF Android Agent.
 * Disabled by default. Callers must obtain user consent and supply local embeddings.
 * Never store credentials, OTPs, payment data, or raw private screen contents.
 */
(function (root) {
  "use strict";
  const SECRET = /(password|passcode|\bpin\b|\botp\b|verification code|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|cvv)/i;
  const DB_VERSION = 1;
  const STORE = "memories";

  function safeVector(value) {
    if (!Array.isArray(value) || !value.length || value.length > 4096) return null;
    const vector = value.map(Number);
    if (!vector.every(Number.isFinite)) return null;
    const norm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0));
    return norm > 0 ? vector : null;
  }
  function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return -1;
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i];
    }
    return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : -1;
  }
  function createIndexedDbStore(indexedDb, name) {
    if (!indexedDb) throw new Error("এই ব্রাউজারে IndexedDB নেই; লোকাল মেমোরি চালু করা যায়নি।");
    let opening;
    function db() {
      if (!opening) opening = new Promise((resolve, reject) => {
        const request = indexedDb.open(name || "mosharrof-agent-memory-v1", DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("লোকাল মেমোরি ডেটাবেস খোলা যায়নি।"));
      });
      return opening;
    }
    async function transact(mode, action) {
      const database = await db();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("লোকাল মেমোরি অপারেশন ব্যর্থ।"));
        tx.onabort = () => reject(tx.error || new Error("লোকাল মেমোরি অপারেশন বাতিল।"));
      });
    }
    return Object.freeze({
      put: record => transact("readwrite", store => store.put(record)),
      delete: id => transact("readwrite", store => store.delete(id)),
      list: () => transact("readonly", store => store.getAll())
    });
  }
  function createMemory(options = {}) {
    const enabled = options.enabled === true;
    let store = options.store || null;
    function storage() {
      if (!store) store = createIndexedDbStore(root.indexedDB, options.databaseName);
      return store;
    }
    const now = options.now || (() => Date.now());
    const makeId = options.makeId || (() => (root.crypto && root.crypto.randomUUID
      ? root.crypto.randomUUID() : "mem-" + now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)));
    function requireEnabled() {
      if (!enabled) throw new Error("লোকাল মেমোরি বন্ধ; ব্যবহারকারীর সম্মতি ছাড়া কিছু সংরক্ষণ করা হয়নি।");
    }
    async function remember(input) {
      requireEnabled();
      const text = String(input && input.text || "").trim();
      const vector = safeVector(input && input.embedding);
      if (!text || text.length > 2000 || SECRET.test(text)) {
        throw new Error("খালি, অতিরিক্ত দীর্ঘ বা গোপন তথ্যসম্বলিত মেমোরি সংরক্ষণ করা যাবে না।");
      }
      if (!vector) throw new Error("বৈধ local embedding প্রয়োজন।");
      const record = { id: makeId(), text, embedding: vector,
        createdAt: now(), tags: Array.isArray(input.tags) ? input.tags.slice(0, 12).map(String) : [] };
      await storage().put(record);
      return { id: record.id, createdAt: record.createdAt };
    }
    async function search(embedding, limit = 5) {
      requireEnabled();
      const query = safeVector(embedding);
      if (!query) throw new Error("সার্চের embedding বৈধ নয়।");
      const rows = await storage().list();
      return rows.map(record => ({ id: record.id, text: record.text, tags: record.tags || [],
        createdAt: record.createdAt, score: cosine(query, safeVector(record.embedding)) }))
        .filter(row => row.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.min(Number(limit) || 5, 20)));
    }
    async function list() {
      requireEnabled();
      const rows = await storage().list();
      return rows.map(record => ({ id: record.id, text: record.text,
        tags: record.tags || [], createdAt: record.createdAt }));
    }
    async function clear() {
      requireEnabled();
      const rows = await storage().list();
      for (const record of rows) await storage().delete(record.id);
      return { deleted: rows.length };
    }
    async function forget(id) {
      requireEnabled();
      if (!String(id || "").trim()) throw new Error("মেমোরির পরিচয় প্রয়োজন।");
      await storage().delete(String(id));
      return { deleted: true };
    }
    return Object.freeze({ remember, search, list, forget, clear, enabled });
  }
  const api = Object.freeze({ createMemory, createIndexedDbStore, cosine });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAgentMemory = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
