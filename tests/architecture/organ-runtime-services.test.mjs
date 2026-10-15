import test from "node:test";
import assert from "node:assert/strict";
import { createOrganRegistry } from "../../core/organ-registry/index.js";
import { createLinkManager } from "../../core/link-manager/index.js";
import { createOrganRuntime } from "../../core/organ-runtime/index.js";

const target = { id: "voice-engine", public_api: ["speak"], dependencies: [] };
const source = { id: "chat-organ", public_api: ["send"], dependencies: [{ organ_id: "voice-engine", api: "speak" }] };
function makeRuntime(records = [target, source], limits = {}, storage = null) {
  const registry = createOrganRegistry(records);
  const links = createLinkManager(registry);
  return { registry, links, runtime: createOrganRuntime({ registry, linkManager: links, limits, storage }) };
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

test("organ memory is isolated and returns defensive copies", () => {
  const { runtime } = makeRuntime();
  runtime.memory.set("chat-organ", "draft", { text: "hello" });
  assert.equal(runtime.memory.get("voice-engine", "draft"), null);
  const read = runtime.memory.get("chat-organ", "draft");
  read.text = "mutated";
  assert.deepEqual(runtime.memory.get("chat-organ", "draft"), { text: "hello" });
});

test("memory rejects secret-like keys, oversized values, and entry overflow", () => {
  const { runtime } = makeRuntime([target], { maxMemoryEntries: 1, maxValueBytes: 20 });
  assert.throws(() => runtime.memory.set("voice-engine", "api-key", "never"), /secret-like keys/);
  assert.throws(() => runtime.memory.set("voice-engine", "large", "x".repeat(50)), /size limit/);
  runtime.memory.set("voice-engine", "one", 1);
  assert.throws(() => runtime.memory.set("voice-engine", "two", 2), /entry limit/);
});

test("invoke requires declared contracts and registered public handlers", async () => {
  const { runtime } = makeRuntime();
  runtime.register("voice-engine", { speak: async ({ text }) => ({ audio: `mock:${text}` }) });
  assert.deepEqual(await runtime.invoke("chat-organ", "voice-engine", "speak", { text: "hello" }), { audio: "mock:hello" });
  await assert.rejects(runtime.invoke("chat-organ", "voice-engine", "private", {}), /Undeclared link/);
  await assert.rejects(runtime.invoke("chat-organ", "voice-engine", "speak", { text: "x".repeat(9000) }), /size limit/);
});

test("handler failures are isolated and reported in bounded health/audit", async () => {
  const { runtime } = makeRuntime([target]);
  runtime.register("voice-engine", { speak: () => { throw new Error("simulated failure"); } });
  runtime.reportIssue("voice-engine", "simulated issue");
  assert.equal(runtime.health("voice-engine").status, "degraded");
  assert.equal(runtime.health("voice-engine").issues, 1);
  assert.equal(runtime.auditLog().at(-1).type, "issue");
});

test("runtime bounds audit history and exposes no persistence or deployment capability", () => {
  const { runtime } = makeRuntime([target], { maxAuditEntries: 2 });
  runtime.reportSuccess("voice-engine", "one");
  runtime.reportSuccess("voice-engine", "two");
  runtime.reportSuccess("voice-engine", "three");
  assert.equal(runtime.auditLog().length, 2);
  assert.equal(runtime.policy.persistence, "memory-only");
  assert.equal(runtime.policy.liveMutation, "not-provided");
});

test("unknown organs and undeclared handler APIs fail closed", () => {
  const { runtime } = makeRuntime();
  assert.throws(() => runtime.memory.set("unknown-organ", "x", 1), /unknown organ/);
  assert.throws(() => runtime.register("voice-engine", { private: () => true }), /not a declared public API/);
});

test("scoped organ capabilities cannot read or report against another organ", () => {
  const { runtime } = makeRuntime();
  const chat = runtime.forOrgan("chat-organ");
  chat.memory.set("draft", { text: "private to chat" });
  assert.deepEqual(chat.memory.get("draft"), { text: "private to chat" });
  assert.equal(runtime.memory.get("voice-engine", "draft"), null);
  chat.reportIssue("test issue");
  assert.equal(runtime.health("chat-organ").issues, 1);
  assert.equal(runtime.health("voice-engine").issues, 0);
  assert.throws(() => chat.register({ speak: () => true }), /not a declared public API/);
});

test("browser-persistent memory survives runtime recreation and remains organ-scoped", () => {
  const storage = fakeStorage();
  const first = makeRuntime([target, source], {}, storage).runtime;
  first.memory.remember("chat-organ", "approved-note", { text: "remembered locally" });
  const second = makeRuntime([target, source], {}, storage).runtime;
  assert.deepEqual(second.memory.recall("chat-organ", "approved-note"), { text: "remembered locally" });
  assert.equal(second.memory.recall("voice-engine", "approved-note"), null);
  assert.equal(second.health("chat-organ").persistentMemoryEntries, 1);
  assert.equal(second.memory.forget("chat-organ", "approved-note"), true);
  assert.equal(second.memory.recall("chat-organ", "approved-note"), null);
});

test("persistent memory rejects secrets and fails clearly without storage", () => {
  const { runtime } = makeRuntime([target]);
  assert.throws(() => runtime.memory.remember("voice-engine", "note", "value"), /unavailable/);
  const persistent = makeRuntime([target], {}, fakeStorage()).runtime;
  assert.throws(() => persistent.memory.remember("voice-engine", "api-key", "never"), /secret-like keys/);
});
