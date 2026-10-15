import test from "node:test";
import assert from "node:assert/strict";
import { createOrganRegistry } from "../../core/organ-registry/index.js";
import { createLinkManager } from "../../core/link-manager/index.js";
import { createOrganRuntime } from "../../core/organ-runtime/index.js";
const target = { id: "voice-engine", public_api: ["speak"], dependencies: [] };
const source = { id: "chat-organ", public_api: ["send"], dependencies: [{ organ_id: "voice-engine", api: "speak" }] };
function makeRuntime(records = [target, source], limits = {}, storage = null) {
  const registry = createOrganRegistry(records);
  return createOrganRuntime({ registry, linkManager: createLinkManager(registry), limits, storage });
}
function fakeStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}
test("scoped organ capabilities cannot access another organ's memory or status", () => {
  const runtime = makeRuntime(), chat = runtime.forOrgan("chat-organ");
  chat.memory.set("draft", { text: "private to chat" });
  assert.deepEqual(chat.memory.get("draft"), { text: "private to chat" });
  assert.equal(runtime.memory.get("voice-engine", "draft"), null);
  chat.reportIssue("test issue");
  assert.equal(runtime.health("chat-organ").issues, 1);
  assert.equal(runtime.health("voice-engine").issues, 0);
  assert.throws(() => chat.register({ speak: () => true }), /not a declared public API/);
});
test("browser-persistent memory survives runtime recreation and remains organ-scoped", () => {
  const storage = fakeStorage(), first = makeRuntime([target, source], {}, storage);
  first.memory.remember("chat-organ", "approved-note", { text: "remembered locally" });
  const second = makeRuntime([target, source], {}, storage);
  assert.deepEqual(second.memory.recall("chat-organ", "approved-note"), { text: "remembered locally" });
  assert.equal(second.memory.recall("voice-engine", "approved-note"), null);
  assert.equal(second.health("chat-organ").persistentMemoryEntries, 1);
  assert.equal(second.memory.forget("chat-organ", "approved-note"), true);
  assert.equal(second.memory.recall("chat-organ", "approved-note"), null);
});
test("persistent memory rejects secrets, enforces entry limits, and fails closed without storage", () => {
  assert.throws(() => makeRuntime([target]).memory.remember("voice-engine", "note", "value"), /unavailable/);
  const runtime = makeRuntime([target], { maxMemoryEntries: 1 }, fakeStorage());
  assert.throws(() => runtime.memory.remember("voice-engine", "api-key", "never"), /secret-like keys/);
  runtime.memory.remember("voice-engine", "one", 1);
  assert.throws(() => runtime.memory.remember("voice-engine", "two", 2), /entry limit/);
});
