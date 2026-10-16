import { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } from "./personal-memory-engine.js";

const DB="mosharrof-personal-memory", STORE="state", CONSENT="mosharrof-personal-memory-enabled-v1";
let initialized=false, engine=null;
function indexedStorage(){
  let opening;
  const db=()=>opening||(opening=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(new Error("এই ব্রাউজারে IndexedDB নেই।"));return;}
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"key"});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error("স্মৃতি ডেটাবেস খোলা যায়নি।"));
  }));
  async function tx(mode,fn){
    const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,mode),r=fn(t.objectStore(STORE));let value;
      r.onsuccess=()=>{value=r.result;};r.onerror=()=>reject(r.error||t.error||new Error("স্মৃতি সংরক্ষণ ব্যর্থ।"));
      t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error||new Error("স্মৃতি সংরক্ষণ ব্যর্থ।"));t.onabort=()=>reject(t.error||new Error("স্মৃতি সংরক্ষণ বাতিল।"));
    });
  }
  return {
    async getItem(key){const row=await tx("readonly",s=>s.get(key));if(row&&typeof row.value==="string")return row.value;
      try{const old=localStorage.getItem(key);if(old){await this.setItem(key,old);localStorage.removeItem(key);return old;}}catch(_){}return null;},
    async setItem(key,value){await tx("readwrite",s=>s.put({key,value:String(value)}));},
    async removeItem(key){await tx("readwrite",s=>s.delete(key));}
  };
}
function bridge(memory){
  if(globalThis.__mosharrofChatMemoryBridge||typeof fetch!=="function")return;
  globalThis.__mosharrofChatMemoryBridge=true;const nativeFetch=fetch.bind(globalThis);
  globalThis.fetch=async function(input,init){
    const url=typeof input==="string"?input:(input&&input.url)||"";
    if(!/\/chat(?:\?|$)/.test(url)||!init||typeof init.body!=="string")return nativeFetch(input,init);
    let body;try{body=JSON.parse(init.body);}catch(_){return nativeFetch(input,init);}
    const text=String(body.text||"").trim();let enabled=false;try{enabled=localStorage.getItem(CONSENT)==="enabled";}catch(_){}
    if(!text||!enabled)return nativeFetch(input,init);
    try{
      body.memory_context=buildPersonalMemoryContext(await memory.exportAll(),text);
      body.memory_suggestions_enabled=true;
    }catch(error){console.warn("MOSHARROF memory unavailable; chat continues without memory.",error);}
    const response=await nativeFetch(input,{...init,body:JSON.stringify(body)});
    response.clone().text().then(async raw=>{
      try{
        let answer="";
        if((response.headers.get("content-type")||"").toLowerCase().includes("text/event-stream")){
          for(const block of raw.split(/\\r?\\n\\r?\\n/))for(const line of block.split(/\\r?\\n/)){
            if(!line.startsWith("data:"))continue;
            try{const event=JSON.parse(line.slice(5).trim());if(event.type==="result"&&event.status>=200&&event.status<300)answer=String(event.data&&event.data.text||"");}catch(_){}
          }
        }else{
          const data=JSON.parse(raw);if(response.ok&&data.ok!==false)answer=String(data.text||"");
        }
        if(response.ok&&answer.trim())await memory.recordTurn(text,answer,body.conversation_id);
        if(response.ok&&body.memory_suggestions_enabled===true){
          try{const data=raw.includes("data:")?JSON.parse(raw.split(/\\r?\\n/).find(line=>line.startsWith("data:")&&line.includes('"type":"result"')).slice(5).trim()).data:JSON.parse(raw);
            for(const candidate of (data&&data.memory_candidates)||[])if(candidate&&candidate.content)await memory.remember({...candidate,status:"pending_confirmation",user_confirmed:false});
          }catch(_){}
        }
      }catch(error){console.warn("MOSHARROF memory turn save skipped.",error);}
    }).catch(()=>{});
    return response;
  };
}
export function initializePersonalMemory(){
  if(initialized||typeof window==="undefined"||!document)return;initialized=true;
  const nav=document.getElementById("navR");if(!nav||document.getElementById("personalMemoryPanel"))return;
  const panel=document.createElement("section");panel.className="nav-family";panel.id="personalMemoryPanel";
  panel.innerHTML='<div class="nav-family-title"><span>🧠</span><span>ব্যক্তিগত স্মৃতি ইঞ্জিন</span></div><p>স্মৃতি এই ডিভাইসের IndexedDB-তে থাকবে। চালু করলে প্রাসঙ্গিক স্মৃতি AI-কে পাঠানো হবে। স্টোরেজ সীমা প্রযোজ্য।</p><label><input type="checkbox" data-m="enabled"> ব্যক্তিগত স্মৃতি চালু</label><div class="audio-setting-row"><input type="search" data-m="query" placeholder="স্মৃতি খুঁজুন"><select data-m="category"><option value="">সব বিষয়</option><option value="preference">ব্যক্তিগত পছন্দ</option><option value="goal">লক্ষ্য</option><option value="project">প্রকল্প</option><option value="correction">সংশোধন</option><option value="decision">সিদ্ধান্ত</option><option value="fact">তথ্য</option><option value="plan">পরিকল্পনা</option><option value="event">ঘটনা</option><option value="open_question">উন্মুক্ত প্রশ্ন</option><option value="commitment">অসমাপ্ত কাজ</option></select></div><div class="device-quick-actions"><button type="button" data-m="refresh">খুঁজুন / রিফ্রেশ</button><button type="button" data-m="export">ব্যাকআপ</button><button type="button" data-m="import">ব্যাকআপ ফেরত</button><input type="file" data-m="file" accept="application/json,.json" hidden><button type="button" data-m="clear">সব স্মৃতি মুছুন</button></div><div data-m="status" role="status" aria-live="polite">প্রস্তুত হচ্ছে…</div><div data-m="rows"></div>';
  nav.appendChild(panel);
  const $=name=>panel.querySelector('[data-m="'+name+'"]'),status=$("status"),rows=$("rows"),query=$("query"),category=$("category"),toggle=$("enabled"),file=$("file");
  let enabled=false;const say=s=>status.textContent=s;
  function render(items){rows.replaceChildren();if(!items.length){rows.textContent="এই অনুসন্ধানে স্মৃতি নেই।";return;}
    for(const item of items){const card=document.createElement("article"),label=document.createElement("p"),btn=document.createElement("button");
      label.textContent="📁 "+item.folder+" · "+item.status+" · "+String(item.created_at||"").slice(0,10)+"\n"+item.content.slice(0,400);
      btn.type="button";btn.textContent=item.status==="pending_confirmation"?"অনুমোদন":"আর্কাইভ";
      btn.onclick=async()=>{if(item.status==="pending_confirmation")await engine.revise(item.id,{status:"active",user_confirmed:true,confidence:.95});else{if(!confirm("এই স্মৃতিটি আর্কাইভ করবেন?"))return;await engine.revise(item.id,{status:"archived"});}await refresh();};
      card.append(label,btn);rows.append(card);
    }
  }
  async function refresh(){if(!engine)return;const r=await engine.recall({query:query.value.trim(),category:category.value||undefined,includeSuperseded:true,limit:40});render(r.items);say((enabled?"স্মৃতি চালু":"স্মৃতি বন্ধ")+" · মোট "+r.total+"টি স্মৃতি");}
  async function setup(){try{engine=createPersonalMemoryEngine({storage:indexedStorage()});enabled=localStorage.getItem(CONSENT)==="enabled";toggle.checked=enabled;if(localStorage.getItem(CONSENT)===null)localStorage.setItem(CONSENT,"disabled");bridge(engine);await refresh();}catch(e){say("মেমোরি চালু করা যায়নি: "+(e.message||e));}}
  toggle.onchange=async()=>{enabled=toggle.checked;try{localStorage.setItem(CONSENT,enabled?"enabled":"disabled");}catch(_){enabled=false;toggle.checked=false;}say(enabled?"স্মৃতি চালু; প্রাসঙ্গিক স্মৃতি চ্যাটে ব্যবহৃত হবে।":"স্মৃতি বন্ধ; আগের স্মৃতি ব্যবহার হবে না।");await refresh();};
  panel.addEventListener("click",async e=>{const b=e.target.closest("button[data-m]");if(!b)return;try{
    if(b.dataset.m==="refresh")await refresh();
    if(b.dataset.m==="export"){const blob=new Blob([JSON.stringify(await engine.exportAll(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="mosharrof-memory-backup.json";a.click();URL.revokeObjectURL(url);say("ব্যাকআপ তৈরি হয়েছে।");}
    if(b.dataset.m==="import")file.click();
    if(b.dataset.m==="clear"&&confirm("সব ব্যক্তিগত স্মৃতি স্থায়ীভাবে মুছবেন?")){await engine.clear();await refresh();say("সব স্মৃতি মুছে ফেলা হয়েছে।");}
  }catch(err){say("ব্যর্থ: "+(err.message||err));}});
  file.onchange=async()=>{const f=file.files&&file.files[0];if(!f)return;try{const r=await engine.importAll(JSON.parse(await f.text()));await refresh();say("ব্যাকআপ থেকে "+r.count+"টি স্মৃতি যুক্ত হয়েছে।");}catch(e){say("ব্যাকআপ ফেরত ব্যর্থ: "+(e.message||e));}finally{file.value="";}};
  query.onkeydown=e=>{if(e.key==="Enter")refresh().catch(()=>{});};category.onchange=()=>refresh().catch(()=>{});setup();
}
if(typeof window!=="undefined"){try{initializePersonalMemory();}catch(e){console.warn("MOSHARROF memory startup failed.",e);}}
