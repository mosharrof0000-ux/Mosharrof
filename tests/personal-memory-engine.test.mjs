import test from "node:test";
import assert from "node:assert/strict";
import {
  createPersonalMemoryEngine, classifyMemory
} from "../web/personal-memory-engine.js";
import { buildPersonalMemoryContext, inferMemoryCandidates } from "../core/personal-memory-engine.js";

function makeStore() {
  const rows = new Map();
  return {
    put: async item => { rows.set(item.id,item); return item.id; },
    get: async id => rows.get(id) || undefined,
    list: async () => [...rows.values()],
    delete: async id => rows.delete(id),
    clear: async () => rows.clear()
  };
}
function makeEngine(store=makeStore()) {
  let tick=0;
  return createPersonalMemoryEngine({store,now:()=>new Date(Date.UTC(2026,0,1,0,0,tick++)).toISOString(),makeId:()=> "test-"+tick});
}

test("memory is organized into topic folders and has no artificial entry-count cap",async()=>{
  const engine=makeEngine();
  for(let i=0;i<150;i++) await engine.remember({content:"প্রকল্প Mosharrof AI-এর ধাপ "+i,category:"project"});
  const all=await engine.all();
  assert.equal(all.total,150);
  assert.equal(all.items[0].folder,"প্রকল্প ও প্রযুক্তি");
  assert.equal((await engine.all({folder:"প্রকল্প ও প্রযুক্তি"})).total,150);
});

test("retrieval prefers matching topics and excludes superseded memories by default",async()=>{
  const engine=makeEngine();
  const old=await engine.remember({content:"Mosharrof AI-এর পুরোনো deploy পরিকল্পনা",category:"project",user_confirmed:true});
  await engine.remember({content:"কুরআনের আরবি ব্যাকরণ ও শব্দমূল গবেষণা",category:"fact"});
  await engine.revise(old.entry.id,{content:"Mosharrof AI-এর বর্তমান deploy পরিকল্পনা"});
  const result=await engine.recall({query:"Mosharrof AI deploy"});
  assert.ok(result.items.some(item=>item.content.includes("বর্তমান deploy")));
  assert.ok(!result.items.some(item=>item.content.includes("পুরোনো deploy")));
  const timeline=await engine.timeline({includeSuperseded:true});
  assert.equal(timeline.total,3);
});

test("turns are remembered and explicit preferences or corrections become learning candidates",async()=>{
  const engine=makeEngine();
  const result=await engine.recordTurn("মনে রাখ, সাধারণ প্রশ্নে সংক্ষিপ্ত বাংলা উত্তর চাই","ঠিক আছে, সাধারণ প্রশ্নে সংক্ষিপ্ত রাখব।");
  assert.equal(result.saved,true);
  assert.ok(result.learned);
  assert.equal(result.learned.category,"preference");
  assert.equal(inferMemoryCandidates("পরের বার আমার পছন্দ অনুযায়ী সংক্ষিপ্ত উত্তর দিও")[0].status,"pending_confirmation");
  assert.equal(classifyMemory("আরও বড় করে লেখো").category,"correction");
});

test("secret-like content is not persisted",async()=>{
  const engine=makeEngine();
  await assert.rejects(engine.remember({content:"আমার password is secret123"}),/not stored in personal memory/i);
  assert.equal((await engine.all()).total,0);
});

test("memory context includes relevant evidence and warns that current instructions win",()=>{
  const context=buildPersonalMemoryContext({memories:[
    {id:"1",content:"ব্যবহারকারী MOSHARROF AI প্রকল্পে main না ভেঙে branch, test, PR চায়",folder:"প্রকল্প ও প্রযুক্তি",category:"preference",status:"active",user_confirmed:true,created_at:"2026-01-01T00:00:00Z"},
    {id:"2",content:"ব্যবহারকারী কুরআনের আরবি শব্দমূল গবেষণা করছে",folder:"গবেষণা ও জ্ঞান",category:"fact",status:"active",created_at:"2026-01-01T00:00:00Z"},
    {id:"3",content:"পুরোনো পরিকল্পনা",folder:"প্রকল্প ও প্রযুক্তি",category:"project",status:"superseded",created_at:"2025-01-01T00:00:00Z"}
  ]},"MOSHARROF AI repository branch test PR");
  assert.match(context,/branch, test, PR/);
  assert.doesNotMatch(context,/পুরোনো পরিকল্পনা/);
  assert.match(context,/Current user instructions override older preferences and plans/);
  assert.doesNotMatch(buildPersonalMemoryContext({memories:[{content:"unrelated cooking recipe",status:"active"}]},"MOSHARROF repository deploy"),/cooking recipe/);
});

test("memory export can be imported without duplicating ids",async()=>{
  const a=makeEngine(), b=makeEngine();
  await a.remember({content:"আমার সক্রিয় প্রকল্প MOSHARROF AI",category:"project"});
  const backup=await a.exportAll();
  assert.equal((await b.importAll(backup)).imported,1);
  assert.equal((await b.importAll(backup)).imported,0);
  assert.equal((await b.all()).total,1);
});
