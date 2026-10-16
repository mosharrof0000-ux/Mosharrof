import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../core/personal-memory-engine.js", import.meta.url), "utf8");
const { createPersonalMemoryEngine, buildPersonalMemoryContext, classifyMemory, inferMemoryCandidates } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function makeStore() {
  const rows = new Map();
  return {
    async put(item) { rows.set(item.id, structuredClone(item)); return item.id; },
    async get(id) { return rows.has(id) ? structuredClone(rows.get(id)) : undefined; },
    async list() { return [...rows.values()].map(item => structuredClone(item)); },
    async delete(id) { rows.delete(id); },
    async clear() { rows.clear(); }
  };
}
function makeEngine() {
  let tick = 0;
  return createPersonalMemoryEngine({
    store: makeStore(),
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
    makeId: () => "test-" + tick
  });
}

test("ledger grows beyond 100 records and keeps topic folders searchable", async () => {
  const engine = makeEngine();
  for (let i = 0; i < 150; i++) {
    await engine.remember({ category: "project", folder: "projects/mosharrof-ai", content: "MOSHARROF AI step " + i });
  }
  assert.equal((await engine.all()).total, 150);
  assert.equal((await engine.all({ folder: "projects/mosharrof-ai" })).total, 150);
});

test("retrieval ranks relevant memories and revisions preserve chronology", async () => {
  const engine = makeEngine();
  const old = await engine.remember({ category: "project", content: "MOSHARROF AI old deploy plan", user_confirmed: true });
  await engine.remember({ category: "fact", content: "কুরআনের আরবি ব্যাকরণ ও শব্দমূল গবেষণা" });
  await engine.revise(old.entry.id, { content: "MOSHARROF AI current deploy plan", user_confirmed: true });
  const result = await engine.recall({ query: "MOSHARROF AI deploy" });
  assert.ok(result.items.some(item => item.content.includes("current deploy")));
  assert.ok(!result.items.some(item => item.content.includes("old deploy")));
  const timeline = await engine.timeline({ includeSuperseded: true });
  assert.equal(timeline.total, 3);
  assert.ok(timeline.items.some(item => item.status === "superseded"));
  assert.ok(timeline.items.some(item => item.supersedes));
});

test("turns learn explicit preferences and corrections without storing secrets", async () => {
  const engine = makeEngine();
  const turn = await engine.recordTurn("মনে রাখ, সাধারণ প্রশ্নে সংক্ষিপ্ত বাংলা উত্তর চাই", "ঠিক আছে, সাধারণ প্রশ্নে সংক্ষিপ্ত রাখব।");
  assert.equal(turn.saved, true);
  assert.ok(turn.learned);
  assert.equal(turn.learned.category, "preference");
  assert.equal(inferMemoryCandidates("পরের বার আমার পছন্দ অনুযায়ী সংক্ষিপ্ত উত্তর দিও")[0].category, "preference");
  assert.equal(classifyMemory("আরও বড় করে লেখো").category, "correction");
  assert.equal((await engine.remember({ content: "API_KEY=do-not-save" })).saved, false);
  assert.equal((await engine.all()).items.some(item => item.content.includes("API_KEY")), false);
});

test("context uses relevant saved evidence and respects current instructions", async () => {
  const engine = makeEngine();
  await engine.remember({ category: "preference", content: "গল্পে বিস্তারিত ঘটনা ও পূর্ণাঙ্গ সমাপ্তি পছন্দ", user_confirmed: true });
  await engine.remember({ category: "goal", content: "MOSHARROF AI-তে স্মৃতি ও ধাপে ধাপে চিন্তার প্রেক্ষাপট ব্যবহার করা" });
  const context = buildPersonalMemoryContext(await engine.exportAll(), "বিস্তারিত ঘটনা পূর্ণাঙ্গ সমাপ্তি");
  assert.match(context, /প্রাসঙ্গিক সংরক্ষিত স্মৃতি/);
  assert.match(context, /পূর্ণাঙ্গ সমাপ্তি/);
  assert.match(context, /বর্তমান ব্যবহারকারীর কথা পুরোনো স্মৃতির চেয়ে অগ্রাধিকার পাবে/);
  assert.equal(buildPersonalMemoryContext(null, "hello"), "");
});

test("export/import and clearing are explicit and reversible", async () => {
  const engine = makeEngine();
  await engine.remember({ category: "goal", content: "ব্যক্তিগত স্মৃতি সংরক্ষণ" });
  const snapshot = await engine.exportAll();
  const imported = createPersonalMemoryEngine({ store: makeStore() });
  assert.equal((await imported.importAll(snapshot)).imported, 1);
  assert.equal((await imported.all()).total, 1);
  await imported.clear();
  assert.equal((await imported.all()).total, 0);
});
