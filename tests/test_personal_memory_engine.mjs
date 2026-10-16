import test from "node:test";
import assert from "node:assert/strict";
import { createPersonalMemoryEngine } from "../core/personal-memory-engine.js";

function memoryStore() {
  const rows = new Map();
  return {
    async put(row) { rows.set(row.id, structuredClone(row)); return row.id; },
    async list() { return [...rows.values()].map(row => structuredClone(row)); },
    async delete(id) { rows.delete(id); },
    async clear() { const count = rows.size; rows.clear(); return count; }
  };
}

test("memory grows without an application-defined entry cap and preserves chronology", async () => {
  const store = memoryStore();
  let clock = 1000;
  let id = 0;
  const engine = createPersonalMemoryEngine({ store, now: () => ++clock, makeId: () => "m" + (++id) });
  for (let i = 0; i < 300; i += 1) {
    const result = await engine.rememberFact({ text: "project milestone number " + i, tags: ["project"] });
    assert.equal(result.saved, true);
  }
  const timeline = await engine.timeline({ limit: 500 });
  assert.equal(timeline.length, 300);
  assert.ok(timeline[0].createdAt < timeline[299].createdAt);
  assert.equal((await engine.profile()).totalEntries, 300);
});

test("new explicit preference supersedes old preference but timeline keeps both", async () => {
  const store = memoryStore();
  let clock = 1700000000000;
  let id = 0;
  const engine = createPersonalMemoryEngine({ store, now: () => ++clock, makeId: () => "p" + (++id) });
  await engine.rememberTurn({ userText: "উত্তরটা ছোট করে বলো", assistantText: "সংক্ষিপ্ত উত্তর।" });
  await engine.rememberTurn({ userText: "এবার বিস্তারিত এবং আরও বড় করে বুঝিয়ে বলো", assistantText: "বিস্তারিত উত্তর।" });
  const profile = await engine.profile();
  assert.equal(profile.preferences.filter(item => item.key === "response_length").length, 1);
  assert.equal(profile.preferences.find(item => item.key === "response_length").value, "detailed");
  const timeline = await engine.timeline({ limit: 20 });
  assert.ok(timeline.some(item => item.status === "superseded" && item.value === "short"));
  const context = await engine.buildContext("গল্পের বিস্তারিত বলো");
  assert.match(context, /active_preference/);
  assert.match(context, /detailed/);
});

test("memory retrieval ranks relevant dated items and excludes secret-like content", async () => {
  const store = memoryStore();
  const engine = createPersonalMemoryEngine({ store, now: () => 1700000000000, makeId: (() => { let i = 0; return () => "r" + (++i); })() });
  assert.equal((await engine.rememberFact({ text: "আমার OTP 123456" })).saved, false);
  await engine.rememberFact({ text: "MOSHARROF AI-তে বাংলা গল্প বিস্তারিত চাই", tags: ["গল্প", "বাংলা"] });
  await engine.rememberFact({ text: "আজ আবহাওয়া নিয়ে কথা হয়েছে", tags: ["আবহাওয়া"] });
  const results = await engine.retrieve("বাংলা গল্প বিস্তারিত", { limit: 5 });
  assert.ok(results.length >= 1);
  assert.match(results[0], /MOSHARROF AI/);
  assert.equal((await store.list()).length, 2);
});

test("memories are organized into topic folders and export preserves the timeline", async () => {
  const store = memoryStore();
  let id = 0;
  const engine = createPersonalMemoryEngine({ store, makeId: () => "folder-" + (++id), now: () => 1700000000000 + id * 1000 });
  await engine.rememberTurn({ userText: "MOSHARROF AI-তে বাংলা গল্প আরও বিস্তারিত লিখবে", assistantText: "বিস্তারিত গল্পের উত্তর" });
  await engine.rememberFact({ text: "কুরআনের আরবি শব্দমূল নিয়ে গবেষণা", tags: ["quran", "research"] });
  const profile = await engine.profile();
  assert.ok(profile.folders["projects/mosharrof-ai"] >= 1);
  assert.ok(profile.folders["research/quran"] >= 1);
  const exported = await engine.exportAll();
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.memories.length, (await store.list()).length);
  assert.ok(exported.memories.every(row => typeof row.folder === "string" && row.folder.includes("/")));
});

test("paused memory does not write; clear removes the local timeline", async () => {
  const store = memoryStore();
  const engine = createPersonalMemoryEngine({ store, enabled: false });
  assert.equal((await engine.rememberFact({ text: "remember this preference" })).saved, false);
  engine.setEnabled(true);
  await engine.rememberFact({ text: "User prefers Bengali explanations" });
  const result = await engine.clear();
  assert.equal(result.cleared, 1);
  assert.equal((await engine.profile()).totalEntries, 0);
});
