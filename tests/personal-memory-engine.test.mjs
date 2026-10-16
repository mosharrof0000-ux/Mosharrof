import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../core/personal-memory-engine.js", import.meta.url), "utf8");
const { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function makeStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values
  };
}

test("topic memories can grow without an artificial entry cap and be retrieved", async () => {
  const storage = makeStorage();
  const memory = createPersonalMemoryEngine({ storage, now: () => "2026-10-17T00:00:00.000Z" });
  for (let i = 0; i < 150; i++) {
    await memory.remember({ id: "project-" + i, category: "project", content: "MOSHARROF AI project step " + i });
  }
  const result = await memory.recall({ category: "project" });
  assert.equal(result.total, 150);
  assert.equal(result.items.length, 150);
  assert.equal((await memory.recall({ query: "project step 149" })).items[0].id, "project-149");
});

test("revisions preserve history and retrieval excludes superseded entries by default", async () => {
  const memory = createPersonalMemoryEngine({ storage: makeStorage(), now: () => "2026-10-17T00:00:00.000Z" });
  const old = await memory.remember({ category: "goal", content: "পুরোনো লক্ষ্য", user_confirmed: true });
  await memory.revise(old.entry.id, { content: "বর্তমান লক্ষ্য", category: "goal", user_confirmed: true });
  assert.equal((await memory.recall()).total, 2);
  assert.equal((await memory.recall()).items.some(item => item.content === "পুরোনো লক্ষ্য"), false);
  assert.equal((await memory.timeline()).total, 2);
});

test("relevant context respects current instructions and secrets are rejected", async () => {
  const memory = createPersonalMemoryEngine({ storage: makeStorage() });
  await memory.remember({ category: "preference", content: "বাংলায় বিস্তারিত উত্তর পছন্দ", user_confirmed: true });
  const context = buildPersonalMemoryContext(await memory.exportAll(), "বাংলায় গল্প লিখুন");
  assert.match(context, /বাংলায় বিস্তারিত উত্তর পছন্দ/);
  assert.match(context, /Current user instructions override older preferences/);
  assert.equal(inferMemoryCandidates("আজ বৃষ্টি হচ্ছে").length, 0);
  await assert.rejects(() => memory.remember({ content: "API_KEY=do-not-save" }), /Secret-like content/);
});
