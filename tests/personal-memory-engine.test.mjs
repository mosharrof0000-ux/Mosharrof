import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalMemoryEngine } from "../core/personal-memory-engine.js";

function adapterStore() {
  const rows = new Map();
  return {
    add: async row => { rows.set(row.id,row); return row.id; },
    list: async () => [...rows.values()],
    clear: async () => { rows.clear(); },
    rows
  };
}
function makeEngine(adapter=adapterStore()) {
  let tick=0;
  const root={localStorage:{getItem:()=>null,setItem:()=>{}},crypto:{randomUUID:()=> "id-"+(++tick)}};
  return {engine:createPersonalMemoryEngine({root,adapter,now:()=>Date.UTC(2026,0,1,0,0,tick++)}),adapter};
}

test("personal memory accumulates without an application entry-count cap and groups by topic",async()=>{
  const {engine}=makeEngine();
  for(let i=0;i<220;i++) await engine.add({kind:"user",text:"MOSHARROF AI project checkpoint "+i,sequence:i});
  const all=await engine.list(500);
  assert.equal(all.length,220);
  const folders=await engine.folders();
  assert.ok(folders.some(folder=>folder.id==="projects"&&folder.count===220));
});

test("retrieval prioritizes relevant topics and avoids unrelated old memories",async()=>{
  const {engine}=makeEngine();
  await engine.add({kind:"user",text:"MOSHARROF AI deploy workflow and branch tests",sequence:1});
  await engine.add({kind:"user",text:"A recipe for cooking rice and lentils",sequence:2});
  const results=await engine.recall("MOSHARROF AI deploy",8);
  assert.ok(results.some(row=>row.text.includes("deploy workflow")));
  assert.ok(!results.some(row=>row.text.includes("cooking rice")));
});

test("preference learning is topic-aware and current context can use it",async()=>{
  const {engine}=makeEngine();
  await engine.add({kind:"user",text:"গল্পে বিস্তারিত ঘটনা ও পূর্ণাঙ্গ সমাপ্তি পছন্দ",sequence:1});
  const rows=await engine.list(50);
  assert.ok(rows.some(row=>row.kind==="preference"&&row.preferences?.[0]?.key==="story_style"));
  const context=await engine.buildContext("একটি গল্প লিখো");
  assert.match(context,/current request overrides it/i);
  assert.match(context,/story_style|fuller story development/i);
  assert.match(context,/PERSONAL MEMORY, OLDEST TO NEWEST/);
});

test("credentials and sensitive personal content are filtered before storage",async()=>{
  const {engine,adapter}=makeEngine();
  const secret=await engine.add({kind:"user",text:"my password is example123",sequence:1});
  const sensitive=await engine.add({kind:"user",text:"my medical record and diagnosis",sequence:2});
  assert.equal(secret.stored,false);
  assert.equal(sensitive.stored,false);
  assert.equal(adapter.rows.size,0);
});

test("memory export/import and clearing work with the persistent store adapter",async()=>{
  const first=makeEngine(), second=makeEngine();
  await first.engine.add({kind:"user",text:"MOSHARROF AI project details",sequence:1});
  const snapshot=await first.engine.exportAll();
  assert.equal((await second.engine.importAll(snapshot)).imported,snapshot.entries.length);
  assert.equal((await second.engine.importAll(snapshot)).imported,0);
  assert.equal((await second.engine.list(20)).length,snapshot.entries.length);
  await second.engine.clear();
  assert.equal((await second.engine.list(20)).length,0);
});
