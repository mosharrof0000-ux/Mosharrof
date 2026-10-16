import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalMemoryEngine, classifyMemoryFolder } from "../core/personal-memory/engine.js";
import { inferResponseStyle } from "../core/personal-memory/length-intent.js";
import { formatRetrievedMemory } from "../core/personal-memory/context.js";

function memoryStore() {
  const map = new Map();
  return {
    async put(item) { map.set(item.id, structuredClone(item)); },
    async get(id) { return structuredClone(map.get(id) ?? null); },
    async all() { return [...map.values()].map(structuredClone); },
    async remove(id) { map.delete(id); },
    async clear() { map.clear(); },
    async count() { return map.size; },
    async exportAll() { return [...map.values()].map(structuredClone); }
  };
}
test("memories are filed by topic and can grow without a configured item cap", async () => {
  const store = memoryStore(), engine = createPersonalMemoryEngine({ store, createId: (() => { let i = 0; return () => "m" + ++i; })() });
  for (let i = 0; i < 150; i++) await engine.remember({ text: "MOSHARROF project deployment note number " + i });
  const stats = await engine.stats();
  assert.equal(stats.count, 150);
  assert.ok(stats.folders.some(row => row.folder === "mosharrof-project" && row.count === 150));
});
test("retrieval prefers relevant memories and does not let stale memory outrank the current request", async () => {
  const engine = createPersonalMemoryEngine({ store: memoryStore(), createId: (() => { let i = 0; return () => "r" + ++i; })() });
  await engine.remember({ text: "User prefers short answers for ordinary questions", folder: "preferences-and-style", userApproved: true });
  await engine.remember({ text: "MOSHARROF Worker deployment should use a reviewed pull request", folder: "mosharrof-project" });
  const result = await engine.contextFor("MOSHARROF Worker deployment pull request");
  assert.ok(result.memories.some(item => item.folder === "mosharrof-project"));
  assert.match(result.text, /current user message takes priority/i);
  assert.match(formatRetrievedMemory([{ folder: "x", text: "old note" }]), /untrusted contextual data/i);
});
test("secret-like content is not saved and conflicting memories are superseded, not erased", async () => {
  const engine = createPersonalMemoryEngine({ store: memoryStore(), createId: (() => { let i = 0; return () => "s" + ++i; })() });
  assert.equal((await engine.remember({ text: "api_key=private-value" })).status, "IGNORED");
  const old = await engine.remember({ text: "Use short answers", folder: "preferences-and-style" });
  const next = await engine.supersede(old.id, "Use detailed answers", { folder: "preferences-and-style", userApproved: true });
  assert.equal(next.status, "SUPERSEDED");
  assert.equal((await engine.get(old.id)).status, "superseded");
  assert.equal((await engine.get(next.newId)).text, "Use detailed answers");
});
test("natural language size inference respects explicit current request first", () => {
  assert.deepEqual(inferResponseStyle("বাংলায় ৫০০০ শব্দের গল্প"), { mode: "normal", source: "default", confidence: 0.55 });
  assert.equal(inferResponseStyle("Write a short answer").mode, "short");
  assert.equal(classifyMemoryFolder("একটা গল্প লিখো"), "writing-and-stories");
});
test("conversation summaries are timestamped and exportable", async () => {
  const engine = createPersonalMemoryEngine({ store: memoryStore(), createId: () => "summary-1" });
  await engine.saveConversationSummary("c1", [{ role: "user", text: "I want a memory engine" }, { role: "assistant", text: "We can build topic folders" }]);
  const bundle = await engine.exportAll();
  assert.equal(bundle.schema, "mosharrof-personal-memory-v1");
  assert.equal(bundle.items[0].kind, "extractive-summary");
});
