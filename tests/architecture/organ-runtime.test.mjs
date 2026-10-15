import test from "node:test";
import assert from "node:assert/strict";
import { createOrganRegistry } from "../../core/organ-registry/index.js";
import { createLinkManager } from "../../core/link-manager/index.js";
import { createOrganRuntime } from "../../core/organ-runtime/index.js";

const target = { id: "voice-engine", public_api: ["speak"], dependencies: [] };
const source = {
  id: "chat-organ",
  public_api: ["send"],
  dependencies: [{ organ_id: "voice-engine", api: "speak" }],
};
const makeRuntime = (records = [target, source], limits = {}) => {
  const registry = createOrganRegistry(records);
  return { registry, links: createLinkManager(registry), runtime: createOrganRuntime({ registry, linkManager: createLinkManager(registry), limits }) };
};

test("registry validates unique ids and declared public APIs", () => {
  const registry = createOrganRegistry([target, source]);
  assert.equal(registry.has("voice-engine"), true);
  assert.equal(registry.resolve("voice-engine", "speak").api, "speak");
  assert.throws(() => createOrganRegistry([target, target]), /Duplicate organ id/);
  assert.throws(() => registry.resolve("voice-engine", "private"), /Undeclared public API/);
});

test("registry rejects missing targets and undeclared target APIs", () => {
  assert.throws(() => createOrganRegistry([{ ...source, dependencies: [{ organ_id: "missing", api: "go" }] }]), /unknown organ/);
  assert.throws(() => createOrganRegistry([{ ...source, dependencies: [{ organ_id: "voice-engine", api: "private" }] }, target]), /does not expose public API/);
});

test("link manager allows declared links only and avoids duplicate edges", () => {
  const registry = createOrganRegistry([target, source]);
  const manager = createLinkManager(registry);
  const first = manager.connect("chat-organ", "voice-engine", "speak");
  const second = manager.connect("chat-organ", "voice-engine", "speak");
  assert.equal(first, second);
  assert.equal(manager.list("chat-organ").length, 1);
  assert.throws(() => manager.connect("chat-organ", "voice-engine", "private"), /Undeclared link/);
  assert.equal(manager.disconnect("chat-organ", "voice-engine", "speak"), true);
  assert.equal(manager.list("chat-organ").length, 0);
});

test("runtime registry enforces the 20-link cap", () => {
  const manyTargets = Array.from({ length: 21 }, (_, index) => ({ id: `target-${index}`, public_api: ["run"], dependencies: [] }));
  const manyDependencies = manyTargets.map((item) => ({ organ_id: item.id, api: "run" }));
  assert.throws(() => createOrganRegistry([...manyTargets, { id: "source-organ", public_api: [], dependencies: manyDependencies }]), /20-link dependency limit/);
});

test("organ memory is isolated by organ and returns defensive copies", () => {
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
  await assert.rejects(runtime.invoke("voice-engine", "voice-engine", "speak", {}), /Undeclared link/);
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
