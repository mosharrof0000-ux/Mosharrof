import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../web/personal-memory-engine.js", import.meta.url), "utf8");
const rows = new Map();
const store = {
  createIndex() {},
  get(key) { return request(rows.get(key) ?? null); },
  put(value) { rows.set(value.id, structuredClone(value)); return request(value.id); },
  getAll() { return request([...rows.values()].map(value => structuredClone(value))); },
  delete(key) { rows.delete(key); return request(undefined); },
  clear() { rows.clear(); return request(undefined); }
};
function request(value) {
  const req = {};
  queueMicrotask(() => { req.result = value; if (req.onsuccess) req.onsuccess(); });
  return req;
}
const db = {
  objectStoreNames: { contains: name => name === "memories" },
  createObjectStore() { return store; },
  transaction() { return { objectStore: () => store, set onabort(fn) { this._onabort = fn; } }; }
};
const indexedDB = { open() {
  const req = { result: db };
  queueMicrotask(() => { if (req.onupgradeneeded) req.onupgradeneeded(); if (req.onsuccess) req.onsuccess(); });
  return req;
}};
const local = new Map();
const root = {
  indexedDB,
  localStorage: { getItem: k => local.get(k) ?? null, setItem: (k,v) => local.set(k,String(v)) },
  document: { getElementById: () => null },
  console,
  confirm: () => true,
  Blob,
  URL,
  setTimeout,
  crypto: { randomUUID: () => Math.random().toString(36).slice(2) }
};
vm.runInNewContext(source, { window: root, globalThis: root, document: root.document, console, Date, Math, Promise, Map, Set, Array, String, Number, JSON, RegExp, Object, URL, Blob, setTimeout, queueMicrotask });
const engine = root.MosharrofMemoryEngine;
assert.ok(engine, "memory engine should initialize");
for (let i = 0; i < 120; i++) {
  await engine.remember("গল্পের দৈর্ঘ্য সম্পর্কে ব্যবহারকারীর পছন্দ নম্বর " + i, "test-user-turn");
}
const all = await engine.list();
assert.equal(all.length, 120, "memory store has no application-level record-count cap");
assert.ok(all.every(item => item.folder.includes("/")), "records are grouped into topic/type folders");
const relevant = await engine.retrieve("গল্পের দৈর্ঘ্য", 8);
assert.ok(relevant.length > 0, "relevant memories should be retrievable");
const context = await engine.contextFor("গল্পের দৈর্ঘ্য");
assert.ok(context.includes("গল্পের দৈর্ঘ্য"), "retrieved memories should form usable chat context");
await engine.remember("আমার API key হলো secret-key-123456", "test-user-turn");
assert.equal((await engine.list()).length, 120, "credential-like messages must not be stored");
await engine.setEnabled(false);
await engine.remember("এটি আরেকটি নতুন স্মৃতি যা সংরক্ষণ করা উচিত নয়", "test-user-turn");
assert.equal((await engine.list()).length, 120, "memory-off must stop writes");
console.log("Personal memory engine tests passed: unlimited count, topic folders, retrieval, secret filter, opt-out.");
