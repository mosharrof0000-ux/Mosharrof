import test from "node:test";
import assert from "node:assert/strict";
import { classifyMemoryTopics, createMemoryEngine } from "../core/personal-memory/memory-engine.js";

function memoryStore() {
  const map = new Map();
  return {
    async put(item) { map.set(item.id, structuredClone(item)); },
    async getAll() { return [...map.values()].map(item => structuredClone(item)); },
    async delete(id) { return map.delete(id); },
    async clear() { map.clear(); },
    size() { return map.size; }
  };
}
function makeEngine() {
  let tick = 0;
  const store = memoryStore();
  const engine = createMemoryEngine({ store, now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)), id: (() => { let n=0; return () => "memory-"+(++n); })() });
  return { engine, store };
}
test("classifies memories into topic folders", () => {
  assert.ok(classifyMemoryTopics("MOSHARROF GitHub worker deploy").includes("projects"));
  assert.ok(classifyMemoryTopics("বাংলায় একটি দীর্ঘ গল্প লিখে দাও").includes("writing"));
});
test("stores an unbounded number of records without an application entry cap", async () => {
  const { engine, store } = makeEngine();
  for (let i=0;i<250;i++) await engine.recordMessage({ text: "User note "+i+" about MOSHARROF project", role: "user", conversationId: "c1" });
  assert.equal(store.size(), 250);
  assert.equal((await engine.listFolders()).some(f=>f.path.startsWith("memory/projects/")), true);
});
test("current conversation summary and relevant past memories are provided with current-first policy", async () => {
  const { engine } = makeEngine();
  await engine.recordMessage({ text: "আমার MOSHARROF project-এর deployment পরীক্ষা করুন", role: "user", conversationId: "old" });
  await engine.recordMessage({ text: "পরের ধাপে tests চালাতে হবে", role: "assistant", conversationId: "old" });
  await engine.recordMessage({ text: "এখন গল্পটা ছোট করে বলো", role: "user", conversationId: "now" });
  const context = await engine.buildContext("এখন গল্পটা ছোট করে বলো", "now");
  assert.match(context, /Current conversation summary/);
  assert.match(context, /Memory policy: current user message and current conversation take priority/);
  assert.ok(context.length <= 5000);
});
test("explicit preference cannot be overwritten by weaker inference; secrets are redacted", async () => {
  const { engine } = makeEngine();
  await engine.recordPreference({ key: "writing.length", value: "detailed", source: "explicit", confidence: 1 });
  const result = await engine.recordPreference({ key: "writing.length", value: "short", source: "inferred", confidence: 0.8 });
  assert.equal(result.stored, false);
  const item = await engine.recordMessage({ text: "api_key=abc123xyz and write a story", role: "user" });
  assert.doesNotMatch(item.text, /abc123xyz/);
});
test("learns only explicit durable memory preferences from user messages", async () => {
  const { engine } = makeEngine();
  await engine.recordMessage({ text: "বর্তমানকে ফলো করবে, অতীতকে চাপিয়ে দেবে না।", role: "user", conversationId: "c1" });
  const context = await engine.buildContext("আগের কাজ নিয়ে কী করব?", "c2");
  assert.match(context, /memory.current-first/);
  await engine.recordMessage({ text: "আমার পছন্দ হলো বিষয়ভিত্তিক ফোল্ডারে স্মৃতি সাজানো।", role: "user", conversationId: "c1" });
  const folders = await engine.listFolders();
  assert.ok(folders.some(folder => folder.path === "memory/preferences"));
});
test("export and delete controls work", async () => {
  const { engine } = makeEngine();
  await engine.recordMessage({ text: "a saved message", role: "user" });
  assert.equal((await engine.exportAll()).records.length, 1);
  assert.equal(await engine.clearAll(), undefined);
  assert.equal((await engine.listRecords()).length, 0);
});
