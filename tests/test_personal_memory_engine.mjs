import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../core/personal-memory-engine.js", import.meta.url), "utf8");
const { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function makeStorage() {
  const values = new Map();
  return {
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, String(value)); },
    async removeItem(key) { values.delete(key); }
  };
}

let tick = 0;
const memory = createPersonalMemoryEngine({
  storage: makeStorage(),
  now: () => new Date(1700000000000 + tick++ * 1000).toISOString()
});

assert.equal((await memory.recall()).total, 0);
const preference = await memory.remember({
  category: "preference", folder: "ব্যক্তিগত পছন্দ",
  content: "বাংলায় উত্তর পছন্দ করি", confidence: 0.95, user_confirmed: true
});
await memory.remember({
  category: "goal", folder: "প্রকল্প ও প্রযুক্তি",
  content: "MOSHARROF AI-তে ব্যক্তিগত স্মৃতি তৈরি করা", confidence: 0.9
});
await memory.remember({
  category: "correction", content: "বড় গল্প চাইলে আরও বিস্তারিত লিখবে",
  relates_to: [preference.entry.id]
});
assert.equal((await memory.recall()).total, 3);
assert.equal((await memory.recall({ category: "preference" })).items[0].content, "বাংলায় উত্তর পছন্দ করি");
assert.equal((await memory.recall({ folder: "প্রকল্প ও প্রযুক্তি" })).items.length, 1);
assert.equal((await memory.recall({ query: "গল্প" })).items[0].category, "correction");

const revised = await memory.revise(preference.entry.id, {
  content: "বাংলায় বিস্তারিত উত্তর পছন্দ করি", confidence: 0.98
});
assert.ok(revised);
assert.equal((await memory.recall()).items.some(item => item.id === preference.entry.id), false);
assert.equal((await memory.recall()).total, 4, "revisions preserve history");

const snapshot = await memory.exportAll();
assert.equal(snapshot.memories.length, 4);
const context = buildPersonalMemoryContext(snapshot, "বাংলায় গল্প আরও বিস্তারিত");
assert.match(context, /USER PERSONAL MEMORY/);
assert.match(context, /বাংলায় বিস্তারিত উত্তর পছন্দ করি/);
assert.doesNotMatch(context, /বাংলায় উত্তর পছন্দ করি/);
assert.equal(buildPersonalMemoryContext(null, "hello"), "");

assert.equal(inferMemoryCandidates("ভবিষ্যতে সবসময় বাংলায় বিস্তারিত উত্তর দেবে")[0].category, "preference");
assert.equal(inferMemoryCandidates("আরও বড় করে লেখো")[0].category, "correction");
assert.equal(inferMemoryCandidates("আজ বৃষ্টি হচ্ছে").length, 0);
assert.equal(inferMemoryCandidates("আমার API key is secret123").length, 0);
await assert.rejects(
  memory.remember({ content: "API_KEY=do-not-save" }),
  /Secret-like content/
);

const before = (await memory.recall()).total;
for (let i = 0; i < 1200; i++) {
  await memory.remember({ category: "event", content: "timeline entry number " + i });
}
assert.equal((await memory.recall()).total, before + 1200, "no artificial entry-count cap");

const imported = createPersonalMemoryEngine({ storage: makeStorage() });
const importedResult = await imported.importAll(await memory.exportAll());
assert.equal(importedResult.count, before + 1200);
assert.equal((await imported.recall()).total, before + 1200);
await imported.clear();
assert.equal((await imported.recall()).total, 0);
await memory.clear();
assert.equal((await memory.recall()).total, 0);
console.log("Personal memory engine: PASS");
