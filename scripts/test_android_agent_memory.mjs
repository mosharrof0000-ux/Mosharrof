import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createMemory } = require("../core/android-agent-memory.js");
const records = new Map();
const store = {
  async put(record) { records.set(record.id, record); },
  async list() { return Array.from(records.values()); },
  async delete(id) { records.delete(id); }
};
let sequence = 0;
const make = enabled => createMemory({ enabled, store, now: () => 1000, makeId: () => "m" + (++sequence) });
await assert.rejects(() => createMemory().remember({ text: "প্রিয় ভাষা বাংলা", embedding: [1, 0] }), /বন্ধ/);
await assert.rejects(() => make(false).remember({ text: "প্রিয় ভাষা বাংলা", embedding: [1, 0] }), /বন্ধ/);
const memory = make(true);
await assert.rejects(() => memory.remember({ text: "password: secret", embedding: [1, 0] }), /গোপন/);
await assert.rejects(() => memory.remember({ text: "বাংলা", embedding: [NaN] }), /embedding/);
const saved = await memory.remember({ text: "প্রিয় ভাষা বাংলা", embedding: [1, 0], tags: ["preference"] });
assert.equal(saved.id, "m1");
await memory.remember({ text: "গান শুনতে ভালো লাগে", embedding: [0.9, 0.1] , tags: ["preference"] });
await memory.remember({ text: "বৃষ্টি পছন্দ", embedding: [0, 1] });
const found = await memory.search([1, 0], 2);
assert.equal(found.length, 2);
assert.equal(found[0].text, "প্রিয় ভাষা বাংলা");
assert.ok(found[0].score > found[1].score);
await memory.forget("m1");
assert.equal(records.has("m1"), false);
assert.equal((await memory.list()).length, 2);
const cleared = await memory.clear();
assert.equal(cleared.deleted, 2);
assert.equal(records.size, 0);
console.log("Android agent local memory contract: PASS");
