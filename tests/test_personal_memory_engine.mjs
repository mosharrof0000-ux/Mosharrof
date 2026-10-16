import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../core/personal-memory-engine.js", import.meta.url), "utf8");
const { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
function makeStore() {
  const rows = new Map();
  return {
    async put(item) { rows.set(item.id, structuredClone(item)); return item.id; },
    async get(id) { return rows.has(id) ? structuredClone(rows.get(id)) : undefined; },
    async list() { return [...rows.values()].map(item => structuredClone(item)); },
    async delete(id) { rows.delete(id); },
    async clear() { rows.clear(); },
    rows
  };
}
let nextId=0,tick=0;
const store=makeStore();
const memory=createPersonalMemoryEngine({store,now:()=>new Date(1700000000000+tick++*1000).toISOString(),makeId:()=> "test-memory-"+(++nextId)});
assert.equal((await memory.all()).total,0);
const preference=await memory.remember({category:"preference",content:"বাংলায় উত্তর পছন্দ করি",confidence:0.95,user_confirmed:true});
await memory.remember({category:"goal",folder:"প্রকল্প ও প্রযুক্তি",content:"MOSHARROF AI-তে ব্যক্তিগত স্মৃতি তৈরি করা",confidence:0.9});
await memory.remember({category:"correction",content:"বড় গল্প চাইলে আরও বিস্তারিত লিখবে",relates_to:[preference.entry.id]});
assert.equal((await memory.all()).total,3);
assert.equal((await memory.recall({folder:"ব্যক্তিগত পছন্দ"})).items[0].content,"বাংলায় উত্তর পছন্দ করি");
assert.equal((await memory.recall({query:"গল্প"})).items[0].category,"correction");
assert.equal((await memory.exportAll()).memories.length,3);
const revised=await memory.revise(preference.entry.id,{content:"বাংলায় বিস্তারিত উত্তর পছন্দ করি",confidence:0.98});
assert.ok(revised.saved);
assert.equal((await memory.all()).items.some(item=>item.id===preference.entry.id&&item.status!=="superseded"),false);
assert.equal((await memory.all()).total,4,"revisions preserve earlier entries");
const profile=await memory.recall({query:"বাংলায় গল্প আরও বিস্তারিত",limit:8});
const context=buildPersonalMemoryContext(profile,"বাংলায় গল্প আরও বিস্তারিত");
assert.match(context,/প্রাসঙ্গিক সংরক্ষিত স্মৃতি/);
assert.match(context,/বাংলায় বিস্তারিত উত্তর পছন্দ করি/);
assert.equal(buildPersonalMemoryContext(null,"hello"),"");
assert.equal(inferMemoryCandidates("ভবিষ্যতে সবসময় বাংলায় বিস্তারিত উত্তর দেবে")[0].category,"preference");
assert.equal(inferMemoryCandidates("আরও বড় করে লেখো")[0].category,"correction");
assert.equal(inferMemoryCandidates("আজ বৃষ্টি হচ্ছে").length,0);
assert.equal(inferMemoryCandidates("আমার API key is secret123").length,0);
const before=(await memory.all()).total;
for(let i=0;i<1200;i++) await memory.remember({category:"event",content:"timeline entry number "+i,confidence:0.5,source:"test"});
assert.equal((await memory.all()).total,before+1200,"there is no application-level memory-entry cap");
const snapshot=await memory.exportAll();
const imported=createPersonalMemoryEngine({store:makeStore(),makeId:()=>"imported-memory"});
assert.equal((await imported.importAll(snapshot)).imported,snapshot.memories.length);
assert.equal((await imported.all()).total,snapshot.memories.length);
await imported.clear(); assert.equal((await imported.all()).total,0);
await memory.clear(); assert.equal((await memory.all()).total,0);
console.log("Personal memory engine: PASS");
