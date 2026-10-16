import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const memorySource = await readFile(new URL("../core/personal-memory-engine.js", import.meta.url), "utf8");
const { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } =
  await import("data:text/javascript;base64," + Buffer.from(memorySource).toString("base64"));

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}
let tick = 0;
const storage = makeStorage();
const memory = createPersonalMemoryEngine({ storage, now: () => new Date(1700000000000 + tick++ * 1000).toISOString() });

assert.equal(memory.recall().total, 0);
const preference = memory.remember({ category: "preference", content: "বাংলায় উত্তর পছন্দ করি", confidence: 0.95, user_confirmed: true });
memory.remember({ category: "goal", folder: "projects/mosharrof-ai", content: "MOSHARROF AI-তে ব্যক্তিগত স্মৃতি তৈরি করা", confidence: 0.9 });
memory.remember({ category: "correction", content: "বড় গল্প চাইলে আরও বিস্তারিত লিখবে", relates_to: [preference.entry.id] });
assert.equal(memory.recall().total, 3);
assert.equal(memory.recall({ category: "preference" }).items[0].content, "বাংলায় উত্তর পছন্দ করি");
assert.equal(memory.recall({ folder: "projects/mosharrof-ai" }).items.length, 1);
assert.equal(memory.recall({ query: "গল্প" }).items[0].category, "correction");
assert.equal(memory.exportAll().memories.length, 3);
const revised = memory.revise(preference.entry.id, { content: "বাংলায় বিস্তারিত উত্তর পছন্দ করি", confidence: 0.98 });
assert.ok(revised);
assert.equal(memory.recall().items.some(item => item.id === preference.entry.id && item.status !== "superseded"), false);
assert.equal(memory.recall().total, 4, "revisions preserve earlier entries rather than erasing history");

const profile = memory.recall();
const context = buildPersonalMemoryContext(profile, "বাংলায় গল্প আরও বিস্তারিত");
assert.match(context, /USER PERSONAL MEMORY/);
assert.match(context, /বাংলায় বিস্তারিত উত্তর পছন্দ করি/);
assert.equal(buildPersonalMemoryContext(null, "hello"), "");

assert.equal(inferMemoryCandidates("ভবিষ্যতে সবসময় বাংলায় বিস্তারিত উত্তর দেবে")[0].category, "preference");
assert.equal(inferMemoryCandidates("আরও বড় করে লেখো")[0].category, "correction");
assert.equal(inferMemoryCandidates("আজ বৃষ্টি হচ্ছে").length, 0);

const importedStorage = makeStorage();
const imported = createPersonalMemoryEngine({ storage: importedStorage });
assert.equal(imported.importAll(memory.exportAll()).count, 4);
assert.equal(imported.recall().total, 4);
assert.equal(memory.clear(), true);
assert.equal(memory.recall().total, 0);
console.log("Personal memory engine: PASS");
