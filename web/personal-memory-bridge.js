/** Connect the persistent browser memory engine to the live chat request/response path. */
import {preparePersonalContext,rememberTurn,memoryEnabled,setMemoryEnabled} from "../core/personal-memory-runtime.js";
const MARK="__mosharrofPersonalMemoryBridgeV1";
function addMemorySettings(){
 if(document.getElementById("mosharrofMemorySettings"))return;
 const root=document.createElement("section");root.id="mosharrofMemorySettings";root.style.cssText="padding:12px;margin:10px;border:1px solid var(--border-color,rgba(128,128,128,.25));border-radius:14px;font-size:14px";
 const title=document.createElement("strong");title.textContent="ব্যক্তিগত স্মৃতি";
 const status=document.createElement("p");status.id="mosharrofMemoryStatus";status.textContent="স্মৃতি ইঞ্জিন প্রস্তুত হচ্ছে…";status.style.cssText="margin:6px 0;color:var(--text-secondary,#777)";
 const toggle=document.createElement("button");toggle.type="button";toggle.textContent=memoryEnabled()?"স্মৃতি চালু · বন্ধ করতে চাপুন":"স্মৃতি বন্ধ · চালু করতে চাপুন";toggle.style.cssText="padding:8px 10px;border-radius:10px;border:1px solid currentColor;background:transparent;color:inherit";
 toggle.addEventListener("click",()=>{const on=!memoryEnabled();setMemoryEnabled(on);toggle.textContent=on?"স্মৃতি চালু · বন্ধ করতে চাপুন":"স্মৃতি বন্ধ · চালু করতে চাপুন";status.textContent=on?"স্মৃতি আবার চালু হয়েছে।":"স্মৃতি বন্ধ। নতুন বার্তা আর সংরক্ষণ/ব্যবহার করা হবে না।"});
 root.append(title,status,document.createElement("br"),toggle);
 const target=document.querySelector("#drawerLeft .drawer-content, #leftDrawer .drawer-content, #drawerLeft, #leftDrawer, aside");
 if(target)target.appendChild(root);else document.body.appendChild(root);
}
function updateStatus(count){const n=document.getElementById("mosharrofMemoryStatus");if(n)n.textContent=memoryEnabled()?"সংরক্ষিত স্মৃতি: "+count+" · বিষয়ভিত্তিক অনুসন্ধান সক্রিয়":"স্মৃতি বন্ধ";}
function install(){
 if(window[MARK])return;window[MARK]=true;addMemorySettings();
 const originalFetch=window.fetch.bind(window);
 window.fetch=async function(input,init){
  let isChat=false,originalText="",prepared=null,requestInit=init;
  try{
   const url=typeof input==="string"?input:input&&input.url;
   if(init&&init.method==="POST"&&String(url||"").includes("/chat")){
    const body=JSON.parse(init.body||"{}");originalText=String(body.text||"");isChat=Boolean(originalText);
    if(isChat&&memoryEnabled()){
     prepared=await preparePersonalContext(originalText,Array.isArray(body.history)?body.history:[]);
     const additions=[];
     if(prepared.context)additions.push(prepared.context);
     if(prepared.style.requestedWords)additions.push("Response length intent inferred from the current request: aim for approximately "+prepared.style.requestedWords+" words; continue in coherent parts if necessary. Current explicit instructions override this estimate.");
     if(additions.length){body.text=originalText+"\n\n[PERSONAL MEMORY / RESPONSE PLANNING]\n"+additions.join("\n\n");requestInit={...init,body:JSON.stringify(body)};}
    }
   }
  }catch(error){console.warn("Personal memory context retrieval skipped:",error)}
  const response=await originalFetch(input,requestInit);
  if(!isChat||!response.ok||!memoryEnabled())return response;
  try{
   const type=(response.headers.get("content-type")||"").toLowerCase();
   if(type.includes("text/event-stream")){
    const clone=response.clone();clone.text().then(async raw=>{
     let answer="";for(const block of raw.split(/\n\s*\n/)){const line=block.split(/\r?\n/).find(v=>v.startsWith("data:"));if(!line)continue;try{const e=JSON.parse(line.slice(5).trim());if(e.type==="result"&&e.data&&Number(e.status||200)<400)answer=String(e.data.text||"")}catch{}}
     if(answer){await rememberTurn(originalText,answer);updateStatus(prepared?.count+2||2)}
    }).catch(e=>console.warn("Memory save skipped:",e));
   }else{
    const clone=response.clone();clone.json().then(async data=>{if(data&&data.text&&response.status<400){await rememberTurn(originalText,String(data.text));updateStatus(prepared?.count+2||2)}}).catch(()=>{});
   }
  }catch(error){console.warn("Personal memory save skipped:",error)}
  return response;
 };
 preparePersonalContext("মেমোরি ইঞ্জিনের অবস্থা").then(v=>updateStatus(v.count)).catch(e=>{const n=document.getElementById("mosharrofMemoryStatus");if(n)n.textContent="স্মৃতি ইঞ্জিন এখন অনুপলব্ধ · "+String(e.message||e)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
