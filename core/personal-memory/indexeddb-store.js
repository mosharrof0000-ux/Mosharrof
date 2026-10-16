const DB_NAME = "mosharrof-personal-memory";
const DB_VERSION = 1;
const STORE_NAME = "items";

export function createIndexedDbMemoryStore(indexedDBRef = globalThis.indexedDB) {
  let opening;
  function open() {
    if (!indexedDBRef) return Promise.reject(new Error("IndexedDB is unavailable in this browser."));
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const request = indexedDBRef.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: "id" });
        if (!store.indexNames.contains("folder")) store.createIndex("folder", "folder", { unique: false });
        if (!store.indexNames.contains("updatedAt")) store.createIndex("updatedAt", "updatedAt", { unique: false });
        if (!store.indexNames.contains("conversationId")) store.createIndex("conversationId", "conversationId", { unique: false });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
      request.onerror = () => { opening = null; reject(request.error || new Error("Could not open memory database.")); };
      request.onblocked = () => reject(new Error("Memory database upgrade is blocked by another open tab."));
    });
    return opening;
  }
  async function transact(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let result;
      try { result = action(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error || new Error("Memory storage transaction failed."));
      tx.onabort = () => reject(tx.error || new Error("Memory storage transaction was aborted."));
    });
  }
  return Object.freeze({
    put(item) { return transact("readwrite", store => store.put(item)); },
    get(id) { return transact("readonly", store => store.get(id)); },
    all() { return transact("readonly", store => store.getAll()); },
    remove(id) { return transact("readwrite", store => store.delete(id)); },
    clear() { return transact("readwrite", store => store.clear()); },
    count() { return transact("readonly", store => store.count()); },
    async exportAll() { return (await this.all()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))); }
  });
}
