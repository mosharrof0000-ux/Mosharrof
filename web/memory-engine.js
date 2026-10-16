/**
 * MOSHARROF Personal Memory Engine v1
 * Client-side, topic-organized memory with bounded retrieval and user-controlled export/reset.
 * "Unlimited" means append-only growth is not hard-capped by this module; browser storage quota still applies.
 */
const PREFIX="mosharrof_memory_v1:";
const PROFILE_KEY=PREFIX+"profile";
const EVENTS_KEY=PREFIX+"events";
const MAX_RECALL=24;
const MAX_EVENT_TEXT=5000;

function safeParse(raw,fallback){try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
function store(){return globalThis.localStorage||null;}
function now(){return new Date().toISOString();}
function cleanText(value,max=MAX_EVENT_TEXT){return String(value??"").trim().slice(0,max);}
function keyFor(text){
  const t=String(text||"").toLowerCase();
  const rules=[
    ["mosharrof-project",/mosharrof|মোশাররফ|github|worker|cloudflare|deployment|repo|প্রজেক্ট|প্রকল্প/],
    ["android-automation",/android|অ্যান্ড্রয়েড|device control|ডিভাইস নিয়ন্ত্রণ|automation|অটোমেশন/],
    ["writing-style",/story|গল্প|উপন্যাস|word|শব্দ|ওয়ার্ড|প্রবন্ধ|লেখা|দৈর্ঘ্য/],
    ["personal-memory-engine",/memory|মেমোরি|স্মৃতি|বুদ্ধিমত্তা|চিন্তা|শেখা|learning/],
    ["quran-research",/quran|কুরআন|কোরআন|আল-কুরআন/],
    ["voice-audio",/tts|voice|ভয়েস|কণ্ঠ|audio|অডিও|জেমিনি|gemini/],
    ["preferences",/পছন্দ|চাই|করবেন|বুঝতে|উত্তর|স্মরণ/]
  ];
  const hits=rules.filter(([,re])=>re.test(t)).map(([k])=>k);
  return hits.length?hits:["general"];
}
function load(key,fallback){const s=store();return s?safeParse(s.getItem(key),fallback):fallback;}
function save(key,value){const s=store();if(!s)return false;try{s.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function tokenize(text){return cleanText(text,12000).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[];}
function relevance(query,event){
  const q=new Set(tokenize(query));if(!q.size)return 0;
  const body=tokenize([event.topic,event.text,event.summary,event.kind].join(" "));
  let hit=0;for(const t of body)if(q.has(t))hit++;
  const topic=String(event.topic||"");if(topic!=="general"&&query.toLowerCase().includes(topic.replace(/-/g," ")))hit+=2;
  return hit/(Math.sqrt(q.size*body.length)||1);
}
export function readMemoryProfile(){
  return load(PROFILE_KEY,{version:1,created_at:now(),updated_at:now(),preferences:{},topics:{},principles:[],revision:0});
}
export function getMemoryStatus(){
  const events=load(EVENTS_KEY,[]);
  return {enabled:!!store(),event_count:Array.isArray(events)?events.length:0,topic_count:Object.keys(readMemoryProfile().topics||{}).length,storage:"browser-local",warning:"Browser storage is finite and may be cleared by the user or browser; export backups regularly."};
}
export function recallRelevantMemories(query,limit=MAX_RECALL){
  const events=load(EVENTS_KEY,[]);if(!Array.isArray(events))return [];
  return events.map((event,index)=>({event,score:relevance(query,event),index})).filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||String(b.event.updated_at||"").localeCompare(String(a.event.updated_at||"")))
    .slice(0,Math.max(1,Math.min(Number(limit)||MAX_RECALL,MAX_RECALL))).map(x=>x.event);
}
export function rememberConversation({userText,assistantText="",summary="",feedback="",confirmed=false}={}){
  const text=cleanText(userText);if(!text)return {saved:false,reason:"empty"};
  // Avoid storing likely secrets, credentials, or authentication material.
  if(/(?:api[_ -]?key|password|passphrase|access[_ -]?token|secret)\s*[:=]\s*\S+/i.test(text))return {saved:false,reason:"possible_secret"};
  const s=store();if(!s)return {saved:false,reason:"storage_unavailable"};
  const profile=readMemoryProfile(),events=load(EVENTS_KEY,[]);
  const topics=keyFor(text),created=now();
  const event={id:"m-"+created.replace(/\D/g,"")+"-"+Math.random().toString(36).slice(2,8),created_at:created,updated_at:created,kind:confirmed?"confirmed-preference":"conversation-context",topic:topics[0],topics,text,summary:cleanText(summary||text,1200),feedback:cleanText(feedback,500),confirmed:!!confirmed,assistant_summary:cleanText(assistantText,600)};
  events.push(event);
  const nextProfile={...profile,updated_at:created,revision:(profile.revision||0)+1,topics:{...(profile.topics||{})}};
  for(const topic of topics){
    const previous=nextProfile.topics[topic]||{count:0,last_seen:null,folder:topic};
    nextProfile.topics[topic]={folder:topic,count:previous.count+1,last_seen:created,last_summary:event.summary};
  }
  const ok=save(EVENTS_KEY,events)&&save(PROFILE_KEY,nextProfile);
  return {saved:ok,id:event.id,topics,event_count:events.length,reason:ok?null:"storage_quota_or_write_failed"};
}
export function recordPreference({topic="preferences",key,value,source="user-explicit",confidence=1}={}){
  if(!key||value==null)return {saved:false,reason:"missing_key_or_value"};
  const profile=readMemoryProfile(),created=now();
  const preferences={...(profile.preferences||{}),[String(key).slice(0,100)]:{value:cleanText(value,1000),source,confidence:Math.max(0,Math.min(1,Number(confidence)||0)),updated_at:created}};
  const topics={...(profile.topics||{}),[topic]:{folder:topic,count:((profile.topics||{})[topic]?.count||0)+1,last_seen:created,last_summary:"Preference: "+key}};
  const ok=save(PROFILE_KEY,{...profile,preferences,topics,updated_at:created,revision:(profile.revision||0)+1});
  return {saved:ok,reason:ok?null:"storage_quota_or_write_failed"};
}
export function exportMemory(){
  return JSON.stringify({format:"mosharrof-memory-v1",exported_at:now(),profile:readMemoryProfile(),events:load(EVENTS_KEY,[])},null,2);
}
export function importMemory(json){
  let data;try{data=typeof json==="string"?JSON.parse(json):json;}catch{return {ok:false,reason:"invalid_json"};}
  if(!data||data.format!=="mosharrof-memory-v1"||!Array.isArray(data.events)||!data.profile)return {ok:false,reason:"invalid_format"};
  const old=load(EVENTS_KEY,[]),byId=new Map((Array.isArray(old)?old:[]).map(e=>[e.id,e]));
  for(const event of data.events)if(event&&event.id&&!byId.has(event.id))byId.set(event.id,event);
  const ok=save(EVENTS_KEY,[...byId.values()])&&save(PROFILE_KEY,data.profile);
  return {ok,events:byId.size,reason:ok?null:"storage_quota_or_write_failed"};
}
export function clearMemory(){
  const s=store();if(!s)return {ok:false};
  try{s.removeItem(EVENTS_KEY);s.removeItem(PROFILE_KEY);return {ok:true};}catch{return {ok:false};}
}
export function formatMemoriesForPrompt(query,limit=8){
  const profile=readMemoryProfile(),events=recallRelevantMemories(query,limit);
  const prefs=Object.entries(profile.preferences||{}).map(([k,v])=>k+": "+v.value).slice(0,20);
  if(!events.length&&!prefs.length)return "";
  return [
    "Relevant user memory (use only when relevant; current request and recent conversation take priority; memory may be outdated and is not proof):",
    ...prefs.map(x=>"- Saved preference: "+x),
    ...events.map(e=>"- ["+e.topic+"] "+e.summary),
    "Do not force old topics into the current answer. Treat inferred preferences as tentative. Ask before irreversible actions."
  ].join("\n");
}
