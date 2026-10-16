import { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } from "./personal-memory-engine.js";

const DB_NAME = "mosharrof-personal-memory";
const DB_VERSION = 1;
const STORE = "state";
const NAMESPACE = "mosharrof.personal-memory.v1";
const SECRET_LIKE = /(password|passcode|api[_ -]?key|access[_ -]?token|secret|otp|one.time.password|private key|পাসওয়ার্ড|পাসওয়ার্ড|গোপন কোড|এপিআই কি|টোকেন)/i;
const COMMAND = /^(?:(?:আমার\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:দেখাও|দেখান|তালিকা|list)|(?:আমার\s*)?(?:সব\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)|(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*.+)$/i;

export function isPersonalMemoryCommand(text) { return COMMAND.test(String(text || "").trim()); }

function createIndexedDbStorage() {
  let opening;
  function database() {
    if (!globalThis.indexedDB) throw new Error("এই ব্রাউজারে IndexedDB নেই; স্মৃতি সংরক্ষণ করা যায়নি।");
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("স্মৃতি ডেটাবেস খোলা যায়নি।"));
    });
    return opening;
  }
  async function transact(mode, action) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), request = action(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("স্মৃতি ডেটাবেসে কাজ ব্যর্থ।"));
      tx.onabort = () => reject(tx.error || new Error("স্মৃতি ডেটাবেসের কাজ বাতিল হয়েছে।"));
    });
  }
  return {
    async getItem(key) {
      const row = await transact("readonly", store => store.get(key));
      if (row && typeof row.value === "string") return row.value;
      // One-time migration from the earlier localStorage ledger, if present.
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) { await this.setItem(key, legacy); localStorage.removeItem(key); return legacy; }
      } catch {}
      return null;
    },
    async setItem(key, value) { return transact("readwrite", store => store.put({ key, value: String(value) })); },
    async removeItem(key) { return transact("readwrite", store => store.delete(key)); }
  };
}

export function createBrowserPersonalMemory() {
  const engine = createPersonalMemoryEngine({ storage: createIndexedDbStorage(), namespace: NAMESPACE });
  async function observe(text) {
    const value = String(text || "").trim();
    if (!value || SECRET_LIKE.test(value)) return;
    const candidates = inferMemoryCandidates(value);
    if (!candidates.length) return;
    const ledger = await engine.exportAll();
    for (const candidate of candidates) {
      const duplicate = ledger.memories.some(item => item.status !== "superseded" && item.content === candidate.content && item.category === candidate.category);
      if (!duplicate) await engine.remember(candidate);
    }
  }
  async function context(text) { return buildPersonalMemoryContext(await engine.exportAll(), String(text || "")); }
  async function command(text) {
    const value = String(text || "").trim();
    if (/^(?:আমার\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:দেখাও|দেখান|তালিকা|list)$/i.test(value)) {
      const report = await engine.recall({ includeSuperseded: true, limit: 50 });
      if (!report.items.length) return "এখনও কোনো ব্যক্তিগত স্মৃতি সংরক্ষিত নেই।";
      return "আপনার সাম্প্রতিক " + report.items.length + "টি স্মৃতি (মোট " + report.total + "টি):\n" + report.items.map(item => "- [" + item.folder + " · " + String(item.status || "active") + " · " + String(item.created_at || "").slice(0,10) + "] " + item.content).join("\n");
    }
    if (/^(?:আমার\s*)?(?:সব\s*)?(?:ব্যক্তিগত\s*)?স্মৃতি\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)$/i.test(value)) {
      if (!globalThis.confirm("সংরক্ষিত সব ব্যক্তিগত স্মৃতি মুছে ফেলবেন? চ্যাটের ইতিহাস আলাদাভাবে থাকবে।")) return "স্মৃতি মোছা বাতিল করা হয়েছে।";
      await engine.clear();
      return "ব্যক্তিগত স্মৃতি মুছে ফেলা হয়েছে। চ্যাটের ইতিহাস আলাদাভাবে অক্ষত আছে।";
    }
    const explicit = value.match(/^(?:মনে রাখো|স্মৃতিতে রাখো|remember)\s*[:：-]?\s*(.{3,})$/i);
    if (explicit) {
      if (SECRET_LIKE.test(explicit[1])) return "নিরাপত্তার জন্য পাসওয়ার্ড, API key, টোকেন বা গোপন কোড ব্যক্তিগত স্মৃতিতে রাখছি না।";
      await engine.remember({ category: "fact", content: explicit[1].trim(), confidence: 1, source: "explicit_user_command", status: "active", user_confirmed: true });
      return "আপনার কথাটি ব্যক্তিগত স্মৃতিতে সংরক্ষণ করেছি। দেখতে চাইলে লিখুন: “আমার স্মৃতি দেখাও”।";
    }
    return "স্মৃতি কমান্ডটি বোঝা যায়নি।";
  }
  return Object.freeze({ observe, context, command, recall: options => engine.recall(options), revise: (id, patch) => engine.revise(id, patch), clear: () => engine.clear(), exportAll: () => engine.exportAll(), importAll: snapshot => engine.importAll(snapshot) });
}

function sseResult(text) {
  const payload = { type: "result", status: 200, data: { ok: true, provider: "local-memory", model: "personal-memory", text } };
  return new Response("data: " + JSON.stringify(payload) + "\n\n", { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" } });
}
function safeText(node, value) { node.textContent = String(value ?? ""); return node; }

function mountMemoryPanel(memory) {
  if (!document.body || document.getElementById("mosharrof-memory-toggle")) return;
  const button = document.createElement("button");
  button.id = "mosharrof-memory-toggle"; button.type = "button"; button.textContent = "🧠 স্মৃতি";
  Object.assign(button.style, { position:"fixed", right:"12px", bottom:"92px", zIndex:"9998", padding:"8px 12px", borderRadius:"20px", background:"#202124", color:"#fff", border:"1px solid #555", fontSize:"12px", boxShadow:"0 2px 12px #0008" });
  const panel = document.createElement("section");
  panel.id = "mosharrof-memory-panel";
  Object.assign(panel.style, { display:"none", position:"fixed", right:"10px", bottom:"136px", zIndex:"9999", width:"min(92vw,380px)", maxHeight:"65vh", overflow:"auto", padding:"14px", borderRadius:"14px", background:"#171717", color:"#f5f5f5", border:"1px solid #555", boxShadow:"0 8px 28px #000a", font:"14px system-ui,sans-serif" });
  const heading = safeText(document.createElement("h3"), "ব্যক্তিগত স্মৃতি");
  heading.style.margin = "0 0 6px";
  const description = safeText(document.createElement("p"), "বিষয়ভিত্তিক স্মৃতি · এই ডিভাইসের IndexedDB-তে সংরক্ষিত");
  description.style.cssText = "font-size:12px;color:#aaa;margin:0 0 10px";
  const search = document.createElement("input"); search.type="search"; search.placeholder="স্মৃতি খুঁজুন"; search.setAttribute("aria-label","স্মৃতি খুঁজুন");
  search.style.cssText = "width:100%;padding:9px;margin:0 0 10px;border-radius:8px;background:#080808;color:white;border:1px solid #555";
  const list = document.createElement("div");
  const actions = document.createElement("div"); actions.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px";
  function action(label, fn) { const b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="padding:8px 10px;border-radius:8px;background:#303030;color:#fff;border:1px solid #666";b.addEventListener("click",fn);actions.appendChild(b);return b; }
  async function render() {
    list.replaceChildren();
    try {
      const report = await memory.recall({ query: search.value, includeSuperseded: true, limit: 30 });
      safeText(description, "মোট " + report.total + "টি · বিষয়ভিত্তিক ফোল্ডার · স্থানীয় সংরক্ষণ");
      if (!report.items.length) { list.appendChild(safeText(document.createElement("p"), "এখনও প্রাসঙ্গিক স্মৃতি নেই।")); return; }
      for (const item of report.items.slice(0,30)) {
        const card=document.createElement("article");card.style.cssText="padding:9px 0;border-top:1px solid #333";
        const meta=safeText(document.createElement("small"), (item.folder||item.category)+" · "+(item.status||"active")+" · "+String(item.created_at||"").slice(0,10));
        meta.style.color="#a5b4fc";
        const content=safeText(document.createElement("p"),item.content);content.style.cssText="margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere";
        card.append(meta,content);
        if(item.status==="pending_confirmation"){
          const approve=document.createElement("button");approve.type="button";approve.textContent="স্মৃতি অনুমোদন";
          approve.style.cssText="padding:5px 8px;border-radius:7px;background:#164e32;color:white;border:1px solid #2e8b57";
          approve.addEventListener("click",async()=>{await memory.revise(item.id,{status:"active",user_confirmed:true,confidence:0.95});await render();});
          card.appendChild(approve);
        }
        list.appendChild(card);
      }
    } catch (error) { safeText(description, "স্মৃতি পড়া যায়নি: "+String(error.message||error)); }
  }
  search.addEventListener("input",()=>{void render();});
  action("JSON রপ্তানি", async()=>{const data=JSON.stringify(await memory.exportAll(),null,2);const blob=new Blob([data],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="mosharrof-personal-memory.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  action("সব স্মৃতি মুছুন", async()=>{if(globalThis.confirm("সব ব্যক্তিগত স্মৃতি স্থায়ীভাবে মুছবেন?")){await memory.clear();await render();}});
  action("বন্ধ",()=>{panel.style.display="none";});
  panel.append(heading,description,search,list,actions);document.body.append(button,panel);
  button.addEventListener("click",async()=>{panel.style.display=panel.style.display==="none"?"block":"none";if(panel.style.display==="block")await render();});
}

export function installPersonalMemoryClient() {
  if (globalThis.__mosharrofMemoryInstalled || !globalThis.fetch || !globalThis.indexedDB) return null;
  globalThis.__mosharrofMemoryInstalled = true;
  const memory=createBrowserPersonalMemory();
  globalThis.MosharrofMemory=memory;
  const nativeFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=async function(input,init={}) {
    const url=typeof input==="string"?input:(input&&input.url)||"";
    if (!/\/chat(?:\?|$)/.test(url) || !init || typeof init.body!=="string") return nativeFetch(input,init);
    let body;
    try { body=JSON.parse(init.body); } catch { return nativeFetch(input,init); }
    const text=String(body.text||"").trim();
    if (!text) return nativeFetch(input,init);
    try {
      if (isPersonalMemoryCommand(text)) return sseResult(await memory.command(text));
      await memory.observe(text);
      body.memory_context=await memory.context(text);
      body.memory_suggestions_enabled=true;
    } catch (error) {
      // Memory failure must never block ordinary chat; the app continues without memory.
      console.warn("MOSHARROF memory unavailable; continuing without saved context.",error);
    }
    const response=await nativeFetch(input,{...init,body:JSON.stringify(body)});
    return response;
  };
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>mountMemoryPanel(memory),{once:true});
  else mountMemoryPanel(memory);
  if (navigator.storage?.persist) navigator.storage.persist().catch(()=>false);
  return memory;
}

if (typeof window!=="undefined") {
  try { installPersonalMemoryClient(); }
  catch (error) { console.warn("MOSHARROF personal memory did not start.",error); }
}
