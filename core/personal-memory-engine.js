/** Personal memory engine: unbounded logical memory with bounded retrieval per prompt. */
export const MEMORY_SCHEMA_VERSION=1;
const MAX_RETRIEVAL_ITEMS=24;
const MAX_RETRIEVAL_CHARS=12000;
const STOP=new Set(["আমি","আমার","তুমি","তোমার","সে","এটা","ওটা","করে","করুন","হবে","হয়","হয়","যেন","করে","একটা","এই","সেই","with","that","this","from","your","have","will","would","could","should","about","into","then","than","and","the","for","are","you","was","were","what","when","where","how","can","want","need","please"]);
function clean(v,n=4000){return String(v??"").replace(/\u0000/g,"").trim().slice(0,n)}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
export function inferMemoryTopics(text){
 const s=clean(text,12000).toLowerCase(),topics=[];
 const rules=[["projects",/mosharrof|মোশাররফ|repo|github|worker|deploy|প্রজেক্ট|প্রকল্প|কোড|অ্যাপ/],["writing",/গল্প|উপন্যাস|প্রবন্ধ|লেখা|শব্দ|word|story|novel|article/],["preferences",/পছন্দ|চাই|চাচ্ছি|ভালো লাগে|সংক্ষিপ্ত|বিস্তারিত|স্বাভাবিক|prefer|preference/],["plans",/পরে|ভবিষ্যৎ|পরিকল্পনা|পরবর্তী|করব|করতে চাই|next|plan|future/],["learning",/শেখ|বুদ্ধি|চিন্তা|বোঝ|স্মৃতি|memory|learn|reason|think/],["devices",/অ্যান্ড্রয়েড|android|ফোন|ডিভাইস|automation|অটোমেশন/],["research",/কুরআন|quran|গবেষণা|research|তথ্যসূত্র/],["personal",/আমার জীবন|আমার কথা|ব্যক্তিগত|পরিবার|নিজের/]];
 for(const [name,re] of rules)if(re.test(s))topics.push(name);
 return topics.length?topics:["general"];
}
export function estimateResponseStyle(text,history=[]){
 const s=clean(text,12000).toLowerCase();
 const explicit=s.match(/(?:about|approximately|around|at least|exactly)?\\s*(\\d{1,2}(?:,\\d{3})+|\\d+)\\s*(?:words?|শব্দ|ওয়ার্ড|ওয়ার্ড)/i);
 const bn=s.match(/(\\d+)\\s*(হাজার|সহস্র)\\s*(?:শব্দ|ওয়ার্ড|ওয়ার্ড)?/);
 let requestedWords=explicit?Number(explicit[1].replace(/,/g,"")):bn?Number(bn[1])*1000:null;
 if(!requestedWords){const indirect=[[/খুব ছোট|এক কথায়|এক লাইনে|সংক্ষেপে|short answer|briefly/,100],[/ছোট করে|সংক্ষিপ্ত করে|ছোট্ট গল্প|short story/,250],[/বিস্তারিত|খুলে বল|ভালোভাবে বুঝিয়ে|ধাপে ধাপে|in detail|step by step/,1200],[/দীর্ঘ গল্প|বড় গল্প|বড় গল্প|উপন্যাস|long story|novel/,2500],[/পুরো ঘটনা|সম্পূর্ণ কাহিনি|বিস্তারে গল্প/,1800]];for(const [re,n] of indirect)if(re.test(s)){requestedWords=n;break}}
 if(!requestedWords){for(let i=history.length-1;i>=0;i--){const h=history[i];if(!h||typeof h!=="object")continue;const t=String(h.text||h.content||"");if(/আরও বড়|আরো বড়|আরও বিস্তারিত|বড় করে|more detail|longer/i.test(t)){requestedWords=1200;break}if(/ছোট কর|সংক্ষেপ কর|এত বড় নয়|shorter|too long/i.test(t)){requestedWords=250;break}}}
 return {requestedWords:requestedWords?Math.max(50,Math.min(20000,requestedWords)):null,style:requestedWords?(requestedWords<400?"concise":requestedWords<1800?"detailed":"longform"):"normal"};
}
export function createMemoryEntry({text,role="user",createdAt=new Date().toISOString(),source="chat",importance}={}){
 const content=clean(text,12000);if(!content)return null;
 const topics=inferMemoryTopics(content),isUser=role==="user";
 const explicitPreference=isUser&&/(আমি চাই|আমার পছন্দ|মনে রাখ|সবসময়|সদাই|ভবিষ্যতে|পরের বার|আমাকে বুঝ|I prefer|remember that|always)/i.test(content);
 const stableFact=isUser&&/(আমার নাম|আমার প্রকল্প|আমার অ্যাপ|আমার লক্ষ্য|my name|my project|my goal)/i.test(content);
 return {id:hash(role+"|"+content),createdAt,updatedAt:createdAt,role:clean(role,16),source:clean(source,32),topics,folder:topics[0],content,kind:explicitPreference?"preference":stableFact?"profile":"episodic",importance:Math.max(0,Math.min(1,Number(importance??(explicitPreference?.95:stableFact?.8:.35)))),status:"active",schemaVersion:MEMORY_SCHEMA_VERSION};
}
export function retrieveRelevantMemories(entries,text,{limit=MAX_RETRIEVAL_ITEMS,maxChars=MAX_RETRIEVAL_CHARS}={}){
 const q=clean(text,12000).toLowerCase(),qTokens=new Set((q.match(/[\\p{L}\\p{N}]{2,}/gu)||[]).filter(t=>!STOP.has(t))),topics=new Set(inferMemoryTopics(q));
 return (Array.isArray(entries)?entries:[]).filter(m=>m&&m.status!=="deleted"&&m.content).map(m=>{
  const body=String(m.content).toLowerCase(),tokens=new Set((body.match(/[\\p{L}\\p{N}]{2,}/gu)||[]));let overlap=0;for(const t of qTokens)if(tokens.has(t))overlap++;
  const topicHits=(m.topics||[m.folder]).filter(t=>topics.has(t)).length;
  const recency=Math.max(0,1-(Date.now()-Date.parse(m.updatedAt||m.createdAt||0))/(365*86400000));
  const score=overlap/(Math.sqrt(Math.max(1,qTokens.size))*Math.sqrt(Math.max(1,tokens.size)))+topicHits*.55+(m.kind==="preference"?.8:0)+Number(m.importance||0)*.25+recency*.05;
  return {memory:m,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).reduce((acc,x)=>{const line="- ["+x.memory.folder+"/"+x.memory.kind+"] "+x.memory.content;if(acc.chars+line.length>maxChars)return acc;acc.items.push(x.memory);acc.lines.push(line);acc.chars+=line.length;return acc},{items:[],lines:[],chars:0});
}
export function buildMemoryContext(retrieval){return retrieval?.lines?.length?"Relevant remembered context (use only when relevant; current request takes priority; memories can be stale):\n"+retrieval.lines.join("\n"):""}
