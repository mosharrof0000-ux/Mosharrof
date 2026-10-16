/* MOSHARROF Personal Memory Engine
 * Device-local IndexedDB. No application-level entry cap; physical browser quota still applies.
 * Stores only explicit preferences/goals and user-approved memory, not inferred sensitive traits.
 */
(function(root){
  "use strict";
  const DB_NAME="mosharrof-personal-memory-v1", STORE="memories", VERSION=1;
  let dbPromise;
  function openDb(){
    if(!root.indexedDB) return Promise.reject(new Error("IndexedDB unavailable"));
    if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{
      const req=root.indexedDB.open(DB_NAME,VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:"id",autoIncrement:true});s.createIndex("kind","kind",{unique:false});s.createIndex("updatedAt","updatedAt",{unique:false});}};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("memory_open_failed"));
    });
    return dbPromise;
  }
  async function transact(mode,fn){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let value;try{value=fn(store);}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error("memory_transaction_failed"));tx.onabort=()=>reject(tx.error||new Error("memory_transaction_aborted"));});}
  function normalize(v,max=4000){return String(v==null?"":v).replace(/\s+/g," ").trim().slice(0,max);}
  async function remember(kind,content,meta={}){
    const text=normalize(content);if(!text)throw new TypeError("memory content is empty");
    const record={kind:normalize(kind,60)||"note",content:text,source:normalize(meta.source||"user",80),confidence:Number.isFinite(meta.confidence)?Math.max(0,Math.min(1,meta.confidence)):1,approved:meta.approved!==false,createdAt:Date.now(),updatedAt:Date.now(),supersedes:meta.supersedes||null};
    return transact("readwrite",s=>s.add(record));
  }
  async function all(){
    const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,"readonly").objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
  }
  async function search(query,limit=12){
    await learnFromTurn(query,"");\n    const q=normalize(query,1000).toLowerCase(),items=await all();
    const terms=q.split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1);
    return items.filter(x=>x.approved).map(x=>({...x,score:terms.reduce((n,t)=>n+((x.content+" "+x.kind).toLowerCase().includes(t)?1:0),0)})).filter(x=>!terms.length||x.score>0).sort((a,b)=>b.score-a.score||b.updatedAt-a.updatedAt).slice(0,Math.max(1,Math.min(30,limit)));
  }
  async function contextFor(query){
    const matches=await search(query,12);
    if(!matches.length)return "";
    return "User-approved device-local memories (dated; use as preferences/context, not guaranteed current facts):\n"+matches.map(x=>"- ["+new Date(x.updatedAt).toISOString().slice(0,10)+"; "+x.kind+"; confidence "+x.confidence+"] "+x.content).join("\n").slice(0,5000);
  }
  async function learnFromTurn(userText,assistantText){
    const user=normalize(userText,2000),answer=normalize(assistantText,1000);
    if(!user)return false;
    // Save an explicit, non-sensitive preference only when the user directly asks for it.
    const patterns=[
      {re:/(?:মনে রাখো|মনে রাখবেন|আমার পছন্দ|সবসময়|সর্বদা).{0,180}/i,kind:"explicit_preference"},
      {re:/(?:remember that|my preference is|i prefer|always|from now on).{0,180}/i,kind:"explicit_preference"}
    ];
    for(const p of patterns){const m=user.match(p.re);if(m){await remember(p.kind,m[0],{source:"explicit_user_statement",approved:true,confidence:0.95});return true;}}
    // Keep a small timeline note only for direct corrections about answer length/style.
    if(/(?:আরও বড়|আরো বড়|আরও বিস্তারিত|ছোট করে|এত বড় নয়|এত বড় নয়|make it longer|make it shorter|more detailed)/i.test(user)){
      await remember("response_feedback",user,{source:"direct_feedback",approved:true,confidence:0.9});return true;
    }
    return false;
  }
  async function exportAll(){return JSON.stringify({schema:1,exportedAt:new Date().toISOString(),memories:await all()},null,2);}
  async function importAll(json){const parsed=typeof json==="string"?JSON.parse(json):json;if(!parsed||!Array.isArray(parsed.memories))throw new TypeError("invalid memory export");for(const x of parsed.memories){if(x&&x.content)await remember(x.kind||"imported",x.content,{source:"import",approved:x.approved!==false,confidence:x.confidence});}return parsed.memories.length;}
  async function clear(){return transact("readwrite",s=>s.clear());}
  root.MosharrofMemoryEngine=Object.freeze({remember,search,contextFor,learnFromTurn,all,exportAll,importAll,clear,storage:"device-local IndexedDB"});
})(typeof window!=="undefined"?window:globalThis);
