import { createIndexedDbMemoryStore, createPersonalMemoryEngine } from "./personal-memory-engine.js";

const CONSENT="mosharrof-personal-memory-enabled-v1";
let initialized=false, engine=null;
export function initializePersonalMemory(){
  if(initialized||typeof window==="undefined"||!document)return;initialized=true;
  const nav=document.getElementById("navR");if(!nav||document.getElementById("personalMemoryPanel"))return;
  const panel=document.createElement("section");panel.className="nav-family";panel.id="personalMemoryPanel";
  panel.innerHTML='<div class="nav-family-title"><span>🧠</span><span>ব্যক্তিগত স্মৃতি ইঞ্জিন</span></div><p>স্মৃতি এই ডিভাইসের IndexedDB-তে থাকবে। চালু করলে প্রাসঙ্গিক স্মৃতি AI-কে পাঠানো হবে। স্টোরেজ সীমা প্রযোজ্য।</p><label><input type="checkbox" data-m="enabled"> ব্যক্তিগত স্মৃতি চালু</label><div class="audio-setting-row"><input type="search" data-m="query" placeholder="স্মৃতি খুঁজুন"><select data-m="category" aria-label="স্মৃতির ফোল্ডার"><option value="">সব বিষয়</option><option value="পছন্দ ও নির্দেশনা">ব্যক্তিগত পছন্দ</option><option value="লক্ষ্য ও পরিকল্পনা">লক্ষ্য ও পরিকল্পনা</option><option value="প্রকল্প ও প্রযুক্তি">প্রকল্প ও প্রযুক্তি</option><option value="সংশোধন ও শেখা">সংশোধন ও শেখা</option><option value="সিদ্ধান্ত">সিদ্ধান্ত</option><option value="তথ্য ও অভিজ্ঞতা">তথ্য ও জ্ঞান</option><option value="অসমাপ্ত প্রশ্ন">অসমাপ্ত প্রশ্ন</option><option value="অনুমান">অনুমান</option><option value="ঘটনা ও কথোপকথন">সময়রেখা ও ঘটনা</option><option value="প্রতিশ্রুতি ও পরবর্তী কাজ">অসমাপ্ত কাজ</option></select></div><div class="device-quick-actions"><button type="button" data-m="refresh">খুঁজুন / রিফ্রেশ</button><button type="button" data-m="export">ব্যাকআপ</button><button type="button" data-m="import">ব্যাকআপ ফেরত</button><input type="file" data-m="file" accept="application/json,.json" hidden><button type="button" data-m="clear">সব স্মৃতি মুছুন</button></div><div data-m="status" role="status" aria-live="polite">প্রস্তুত হচ্ছে…</div><div data-m="rows"></div>';
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
  async function setup(){try{engine=createPersonalMemoryEngine({store:createIndexedDbMemoryStore()});const setting=localStorage.getItem(CONSENT);enabled=setting!=="disabled";toggle.checked=enabled;if(setting===null)localStorage.setItem(CONSENT,"enabled");await refresh();}catch(e){say("মেমোরি চালু করা যায়নি: "+(e.message||e));}}
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
