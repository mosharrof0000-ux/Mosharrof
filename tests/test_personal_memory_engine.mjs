import assert from "node:assert/strict";
import { createPersonalMemoryEngine } from "../core/personal-memory-engine.js";
import { buildChatContext } from "../core/chat-context.js";

const rows = [];
const adapter = {
  async add(row) { if (rows.some(item => item.id === row.id)) throw new Error("duplicate"); rows.push(structuredClone(row)); },
  async list() { return structuredClone(rows); },
  async clear() { rows.length = 0; }
};
let time = 1_800_000_000_000;
let id = 0;
const prefs = new Map();
const root = { localStorage: { getItem: key => prefs.has(key) ? prefs.get(key) : null, setItem: (key, value) => prefs.set(key, value) } };
const memory = createPersonalMemoryEngine({ root, adapter, now: () => ++time, makeId: () => "id-" + (++id) });

assert.equal(memory.enabled(), true, "memory is enabled after the user's explicit request");
const first = await memory.add({ kind: "user", text: "গল্পটা আরও বড় করে বিস্তারিত লেখো, পরের বারও মনে রাখো" });
assert.equal(first.stored, true);
assert.ok(rows.some(row => row.kind === "preference" && row.text.includes("response_length")));
assert.ok(rows.some(row => row.kind === "preference" && row.text.includes("explicit_preference")));
await memory.add({ kind: "assistant", text: "এটি একটি ধারাবাহিক গল্পের সূচনা।" });
const context = await memory.buildContext("আমাকে একটি গল্প লিখে দাও");
assert.match(context, /PERSONAL MEMORY/);
assert.match(context, /response_length/);
assert.match(context, /explicit_preference/);
assert.ok(rows.every((row, index) => index === 0 || row.sequence >= rows[0].sequence), "memory records retain chronology");
assert.ok(rows.some(row => row.folder?.id === "writing"), "memories are filed into topic folders");
const folders = await memory.folders();
assert.ok(folders.some(folder => folder.id === "writing" && folder.count > 0), "topic folder counts are available");
assert.ok((await memory.listFolder("writing", 20)).length > 0, "folder-based recall works");
assert.equal(memory.classifyFolder("মেমোরি ইঞ্জিন তৈরি করুন").id, "memory-learning");
const timeline = await memory.timeline(20);
assert.ok(timeline.every((row, index) => index === 0 || row.sequence >= timeline[index - 1].sequence), "timeline stays chronological");
const combined = buildChatContext("বর্তমান প্রশ্ন", [], "পুরোনো প্রাসঙ্গিক স্মৃতি");
assert.ok(combined.indexOf("পুরোনো প্রাসঙ্গিক স্মৃতি") < combined.indexOf("বর্তমান প্রশ্ন"));
assert.match(combined, /Current user message/);
assert.equal(folders.find(folder => folder.id === "writing")?.count, 3);
assert.equal((await memory.listFolder("writing")).length, 3);
assert.ok((await memory.search("response_length")).some(row => row.kind === "preference"));
assert.ok((await memory.exportAll()).entries.length >= 4);
const secret = await memory.add({ kind: "user", text: "আমার password is secret123" });
assert.equal(secret.stored, false, "obvious credentials are never stored");
memory.setEnabled(false);
assert.equal(memory.enabled(), false);
assert.deepEqual(await memory.recall("গল্প"), []);
memory.setEnabled(true);
const listed = await memory.list(100);
assert.ok(listed.length >= 3);
await memory.clear();
assert.equal((await memory.list()).length, 0);
console.log("Personal memory engine tests passed.");
