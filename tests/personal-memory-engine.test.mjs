import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../core/personal-memory-engine.js", import.meta.url), "utf8");
const { createPersonalMemoryEngine, buildPersonalMemoryContext, inferMemoryCandidates } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function makeStorage() {
  const rows = new Map();
  return {
    async getItem(key) { return rows.has(key) ? rows.get(key) : null; },
    async setItem(key, value) { rows.set(key, String(value)); },
    async removeItem(key) { rows.delete(key); }
  };
}

function makeEngine() {
  let tick = 0;
  return createPersonalMemoryEngine({
    storage: makeStorage(),
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString()
  });
}

test("ledger grows beyond 100 records and keeps topic folders searchable", async () => {
  const engine = makeEngine();
  for (let i = 0; i < 150; i++) {
    await engine.remember({ category: "project", folder: "projects/mosharrof-ai", content: "MOSHARROF AI step " + i });
  }
  assert.equal((await engine.recall()).total, 150);
  assert.equal((await engine.recall({ folder: "projects/mosharrof-ai" })).items.length, 150);
  assert.equal((await engine.timeline()).items.length, 150);
});

test("revisions preserve chronology and current memory context", async () => {
  const engine = makeEngine();
  const old = await engine.remember({ category: "preference", content: "বাংলায় উত্তর পছন্দ করি", user_confirmed: true });
  const revised = await engine.revise(old.entry.id, { content: "বাংলায় বিস্তারিত উত্তর পছন্দ করি", category: "preference", user_confirmed: true });
  assert.ok(revised);
  assert.equal((await engine.recall()).items.some(item => item.id === old.entry.id), false);
  assert.equal((await engine.timeline()).items.length, 2);
  assert.match(buildPersonalMemoryContext(await engine.exportAll(), "বাংলায় উত্তর দাও"), /বাংলায় বিস্তারিত উত্তর পছন্দ করি/);
});

test("secret-like content is rejected and casual messages are not auto-promoted", async () => {
  const engine = makeEngine();
  await assert.rejects(() => engine.remember({ content: "API_KEY=do-not-save" }), /Secret-like content/);
  assert.equal(inferMemoryCandidates("আজ বৃষ্টি হচ্ছে").length, 0);
  assert.equal(inferMemoryCandidates("ভবিষ্যতে সবসময় বাংলায় বিস্তারিত উত্তর দেবে")[0].category, "preference");
});
