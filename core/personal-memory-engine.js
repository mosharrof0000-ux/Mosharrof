/**
 * Personal Intelligence & Memory Engine.
 * No artificial entry-count cap; actual browser storage quotas still apply.
 * This module is also imported by the Worker for pure context-building helpers.
 */
const SCHEMA_VERSION = 1;
const DEFAULT_NAMESPACE = "mosharrof.personal-memory.v1";
const MAX_CONTEXT_CHARS = 9000;
const CATEGORIES = new Set(["preference","goal","project","correction","decision","fact","open_question","plan","hypothesis","event","commitment"]);
const FOLDERS = { preference:"পছন্দ ও নির্দেশনা", goal:"লক্ষ্য ও পরিকল্পনা", project:"প্রকল্প ও প্রযুক্তি", correction:"সংশোধন ও শেখা", decision:"সিদ্ধান্ত", fact:"তথ্য ও অভিজ্ঞতা", open_question:"অসমাপ্ত প্রশ্ন", plan:"লক্ষ্য ও পরিকল্পনা", hypothesis:"অনুমান", event:"ঘটনা ও কথোপকথন", commitment:"প্রতিশ্রুতি ও পরবর্তী কাজ" };
const SECRET_LIKE = /(password|passcode|\bpin\b|\botp\b|api[_ -]?key|access[_ -]?token|secret|verification code|পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|পিন কোড|কার্ড নম্বর|cvv)/i;
const clean = (value, limit = 2000) => String(value ?? "").replace(/\u0000/g, "").trim().slice(0, limit);
const safeTime = value => { const parsed = Date.parse(value || ""); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString(); };
const clone = value => JSON.parse(JSON.stringify(value));

export function createIndexedDbMemoryStore(indexedDB = globalThis.indexedDB, dbName = "mosharrof-personal-memory-v1") {
  if (!indexedDB) throw new Error("এই ব্রাউজারে IndexedDB পাওয়া যায়নি।");
  const storeName = "memory-ledger";
  let opening;
  function database() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("মেমোরি ডেটাবেস খোলা যায়নি।"));
      request.onblocked = () => reject(new Error("মেমোরি ডেটাবেস আপডেট আটকে আছে; পৃষ্ঠা রিফ্রেশ করুন।"));
    });
    return opening;
  }
  async function transact(mode, action) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode), request = action(tx.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("মেমোরি ডেটাবেস অপারেশন ব্যর্থ।"));
      tx.onabort = () => reject(tx.error || new Error("মেমোরি ডেটাবেস অপারেশন বাতিল হয়েছে।"));
    });
  }
  return Object.freeze({
    get: id => transact("readonly", store => store.get(id)),
    put: item => transact("readwrite", store => store.put(item)),
    delete: id => transact("readwrite", store => store.delete(id)),
    list: () => transact("readonly", store => store.getAll()),
    clear: () => transact("readwrite", store => store.clear())
  });
}

export function createPersonalMemoryEngine({ storage, store, namespace = DEFAULT_NAMESPACE, now = () => new Date().toISOString(), makeId } = {}) {
  const backingStorage = storage || (store ? {
    async getItem(key) { const item = await store.get(key); return item?.value ?? null; },
    async setItem(key, value) { await store.put({ id: key, value }); },
    async removeItem(key) { await store.delete(key); }
  } : null);
  if (!backingStorage || typeof backingStorage.getItem !== "function" || typeof backingStorage.setItem !== "function") throw new TypeError("A persistent storage adapter or store is required.");
  const key = clean(namespace, 160);
  async function readLedger() {
    const raw = await backingStorage.getItem(key);
    if (!raw) return { schema_version: SCHEMA_VERSION, revision: 0, memories: [] };
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.schema_version !== SCHEMA_VERSION || !Array.isArray(parsed.memories)) throw new Error("schema");
      return { schema_version: SCHEMA_VERSION, revision: Number(parsed.revision) || 0, memories: parsed.memories.filter(m => m && typeof m === "object") };
    } catch { throw new Error("Personal memory ledger is unreadable; export or recover it before writing."); }
  }
  async function save(ledger) {
    ledger.revision += 1;
    ledger.updated_at = safeTime(now());
    await backingStorage.setItem(key, JSON.stringify(ledger));
    return { revision: ledger.revision, count: ledger.memories.length };
  }
  async function remember(input) {
    if (!input || typeof input !== "object") throw new TypeError("Memory entry must be an object.");
    const content = clean(input.content, 4000);
    if (!content) throw new TypeError("Memory content is required.");
    if (SECRET_LIKE.test(content)) throw new Error("Secret-like content rejected.");
    const category = CATEGORIES.has(input.category) ? input.category : "fact";
    const ledger = await readLedger();
    const timestamp = safeTime(now());
    const entry = {
      id: clean(input.id, 120) || (typeof makeId === "function" ? makeId() : "mem-" + timestamp.replace(/[^0-9]/g,"").slice(0,14) + "-" + (ledger.revision + 1)),
      category, folder: clean(input.folder || FOLDERS[category] || FOLDERS.fact,120), content,
      confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.65) || 0)),
      source: clean(input.source || "conversation", 80),
      status: ["active","pending_confirmation","superseded","resolved","archived"].includes(input.status) ? input.status : "active",
      created_at: safeTime(input.created_at || now()), updated_at: timestamp,
      valid_from: input.valid_from ? safeTime(input.valid_from) : null,
      valid_until: input.valid_until ? safeTime(input.valid_until) : null,
      conversation_id: clean(input.conversation_id,120),
      relates_to: Array.isArray(input.relates_to) ? input.relates_to.map(v => clean(v,120)).filter(Boolean).slice(0,20) : [],
      supersedes: clean(input.supersedes,120) || null,
      rationale: clean(input.rationale,500),
      user_confirmed: input.user_confirmed === true
    };
    if (input.supersedes) {
      const previous = ledger.memories.find(m => m.id === input.supersedes);
      if (previous) previous.status = "superseded";
    }
    ledger.memories.push(entry);
    return { saved: true, ...await save(ledger), entry: clone(entry) };
  }
  async function revise(id, patch = {}) {
    const ledger = await readLedger();
    const old = ledger.memories.find(m => m.id === clean(id,120));
    if (!old) return null;
    old.status = "superseded";
    const next = { ...old, ...patch, id: undefined, supersedes: old.id, status: patch.status || "active", created_at: now() };
    ledger.memories.push({
      ...next, id: "mem-" + String(Date.parse(now()) || Date.now()) + "-" + (ledger.revision + 1),
      category: CATEGORIES.has(next.category) ? next.category : "fact",
      folder: clean(next.folder || FOLDERS[next.category] || FOLDERS.fact,120),
      content: clean(next.content,4000), created_at: safeTime(now()), updated_at: safeTime(now()),
      confidence: Math.max(0,Math.min(1,Number(next.confidence ?? 0.65) || 0)),
      user_confirmed: next.user_confirmed === true
    });
    const result = await save(ledger);
    return { saved: true, ...result, entry: clone(ledger.memories[ledger.memories.length-1]) };
  }
  async function recall({ category, query, includeSuperseded = false, includePending = true, limit, folder } = {}) {
    const ledger = await readLedger();
    const terms = clean(query,300).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    let items = ledger.memories.filter(m =>
      (includeSuperseded || !["superseded","archived"].includes(m.status)) &&
      (includePending || m.status !== "pending_confirmation") &&
      (!category || m.category === category) && (!folder || (m.folder || m.category) === folder));
    if (terms.length) items = items.map(m => {
      const lower = String(m.content).toLowerCase();
      const overlap = terms.reduce((n,t) => n + (lower.includes(t) ? 1 : 0),0);
      const score = overlap * 3 + (m.user_confirmed ? 8 : 0) + (m.category === "preference" ? 2 : 0);
      return { m, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score-a.score || String(b.m.updated_at).localeCompare(String(a.m.updated_at))).map(x=>x.m);
    else items.sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const count = Number.isInteger(limit) && limit > 0 ? limit : items.length;
    return { revision: ledger.revision, total: ledger.memories.length, items: clone(items.slice(0,count)) };
  }
  async function timeline({ includeSuperseded = true, category, after, before, limit, offset = 0 } = {}) {
    const ledger = await readLedger();
    let items = ledger.memories.filter(m => (includeSuperseded || !["superseded","archived"].includes(m.status)) && (!category || m.category === category) && (!after || Date.parse(m.created_at) >= Date.parse(after)) && (!before || Date.parse(m.created_at) <= Date.parse(before)));
    items.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
    const start=Math.max(0,Number(offset)||0), end=Number.isInteger(limit)&&limit>0?start+limit:items.length;
    return { total:items.length, offset:start, items:clone(items.slice(start,end)) };
  }
  async function all({ category, folder, includeSuperseded = true, limit, offset = 0 } = {}) {
    const ledger = await readLedger();
    let items = ledger.memories.filter(m => (includeSuperseded || !["superseded", "archived"].includes(m.status)) && (!category || m.category === category) && (!folder || (m.folder || m.category) === folder));
    items.sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const start = Math.max(0, Number(offset) || 0), end = Number.isInteger(limit) && limit > 0 ? start + limit : items.length;
    return { total: items.length, offset: start, items: clone(items.slice(start, end)) };
  }
  async function recordTurn(userText, assistantText = "", options = {}) {
    const candidates = inferMemoryCandidates(userText);
    const learned = candidates[0] || null;
    const turn = await remember({ content: "ব্যবহারকারীর বার্তা: " + clean(userText, 1800) + (assistantText ? "\nসহকারীর উত্তর: " + clean(assistantText, 1000) : ""), category: "event", source: "conversation_turn", confidence: 0.75, status: "active", conversation_id: options && options.conversation_id });
    if (!turn.saved) return { ...turn, learned: null };
    if (learned) {
      const ledger = await readLedger();
      const duplicate = ledger.memories.some(item => item.status !== "superseded" && item.category === learned.category && item.content === learned.content);
      if (!duplicate) await remember({ ...learned, status: "pending_confirmation" });
    }
    return { ...turn, learned };
  }
  async function exportAll() { return clone(await readLedger()); }
  async function importAll(snapshot) {
    if (!snapshot || snapshot.schema_version !== SCHEMA_VERSION || !Array.isArray(snapshot.memories)) throw new TypeError("Unsupported memory export.");
    const ledger=await readLedger(), known=new Set(ledger.memories.map(m=>m.id));
    let imported = 0;
    for (const item of snapshot.memories) if (item && typeof item==="object" && item.id && !known.has(item.id) && !SECRET_LIKE.test(String(item.content||""))) {
      const category=CATEGORIES.has(item.category)?item.category:"fact";
      ledger.memories.push({...item,content:clean(item.content,4000),category,folder:clean(item.folder || FOLDERS[category] || FOLDERS.fact,120)});
      known.add(item.id); imported += 1;
    }
    return { ...await save(ledger), imported };
  }
  async function clear() {
    if (typeof backingStorage.removeItem !== "function") throw new TypeError("Storage adapter does not support deletion.");
    await backingStorage.removeItem(key); return true;
  }
  return Object.freeze({ remember, revise, recall, timeline, all, recordTurn, exportAll, importAll, clear });
}

export function buildPersonalMemoryContext(profile, currentText = "") {
  if (!profile || typeof profile !== "object") return "";
  const entries=Array.isArray(profile)?profile:Array.isArray(profile.memories)?profile.memories:Array.isArray(profile.items)?profile.items:[];
  const current=clean(currentText,1500).toLowerCase();
  const terms=current.split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>2);
  const followup=/(এটা|সেটা|ওটা|আগের|চালিয়ে|চালিয়ে|আরও|তারপর|ওই|continue|that|it|previous|earlier|next|same)/i.test(currentText);
  const ranked=entries.filter(m=>m&&typeof m==="object"&&!["superseded","archived","resolved"].includes(m.status))
    .map((m,index)=>{
      const content=clean(m.content,1000), lower=content.toLowerCase();
      const overlap=terms.reduce((n,term)=>n+(lower.includes(term)?1:0),0);
      const recency=Number.isFinite(Date.parse(m.updated_at||m.created_at))?Date.parse(m.updated_at||m.created_at)/1e13:0;
      const pending=m.status==="pending_confirmation";
      const score=(m.user_confirmed?8:0)+overlap*3+(m.category==="preference"&&overlap>0?2:0)+(pending?-5:0)+recency;
      return {m,content,score,index,overlap};
    }).filter(x=>x.content&&(followup||x.overlap>0)).sort((a,b)=>b.score-a.score||b.index-a.index);
  const selected=[]; let used=0;
  for(const item of ranked){
    const line="- ["+clean(item.m.folder||item.m.category||"fact",40)+"; status "+clean(item.m.status||"active",32)+"; confidence "+Math.max(0,Math.min(1,Number(item.m.confidence??0.6)))+"; date "+String(item.m.created_at||"").slice(0,10)+"] "+item.content;
    if(used+line.length>MAX_CONTEXT_CHARS)continue;
    selected.push(line);used+=line.length;
  }
  if(!selected.length)return "";
  return [
    "USER PERSONAL MEMORY (local user-provided conversation history and preferences; may be incomplete or outdated):",
    "Retrieve only memories relevant to the current request. বর্তমান ব্যবহারকারীর কথা পুরোনো স্মৃতির চেয়ে অগ্রাধিকার পাবে; current user instructions override older preferences and plans.",
    "Treat pending_confirmation entries as tentative hypotheses, not established facts. Confirm important or high-impact assumptions.",
    "Consider chronological order: distinguish past events, current goals, future plans, and open questions. Use what happened before to understand the present; superseded entries are not current.",
    "Think ahead only as a grounded possibility from stated goals and events; explain uncertainty briefly and do not claim to know private thoughts.",
    ...selected
  ].join("\n");
}

export function inferMemoryCandidates(userText) {
  const text=clean(userText,4000);
  if(!text||SECRET_LIKE.test(text))return [];
  const lower=text.toLowerCase();
  const explicitPreference=/(মনে রাখ|ভবিষ্যতে|পরের বার|সবসময়|সব সময়|আমার পছন্দ|আমি চাই|i prefer|remember that|from now on|always)/i.test(text);
  const correction=/(না,? এভাবে নয়|এভাবে না|আরও বড়|আরও ছোট|বিস্তারিত কর|সংক্ষিপ্ত কর|that's not|instead|make it longer|make it shorter)/i.test(text);
  const goal=/(লক্ষ্য|পরিকল্পনা|তৈরি করছি|বাস্তবায়ন|বাস্তবায়ন|i am building|my goal|plan to)/i.test(text);
  const project=/(প্রজেক্ট|প্রকল্প|রেপো|repository|github|mosharrof|মোশাররফ ai|অ্যাপ তৈরি|app development)/i.test(text);
  const commitment=/(করব|করতে হবে|পরের ধাপ|বাকি কাজ|follow up|next step|finish|সম্পন্ন করতে হবে)/i.test(text);
  const decision=/(সিদ্ধান্ত|ঠিক করেছি|বেছে নিয়েছি|বেছে নিয়েছি|decided|decision)/i.test(text);
  const question=/(কীভাবে সম্ভব|কী হতে পারে|কেন এমন|what if|how can i|কিভাবে করব)/i.test(text);
  if(!explicitPreference&&!correction&&!goal&&!project&&!commitment&&!decision&&!question)return [];
  const category=correction?"correction":explicitPreference?"preference":project?"project":commitment?"commitment":decision?"decision":question?"open_question":"goal";
  return [{category,folder:category,content:text,confidence:explicitPreference?0.9:correction?0.82:project?0.78:0.7,source:"conversation_candidate",status:"active",user_confirmed:false,rationale:"Tentative memory candidate extracted from explicit wording; may be reviewed or corrected."}];
}

export function classifyMemory(text) {
  const candidate = inferMemoryCandidates(text)[0];
  if (candidate) return candidate;
  return { category: "fact", folder: "তথ্য ও অভিজ্ঞতা", content: clean(text,4000), confidence: 0.55, status: "pending_confirmation", user_confirmed: false };
}
