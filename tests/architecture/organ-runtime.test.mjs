import test from "node:test";
import assert from "node:assert/strict";
import { createOrganRegistry } from "../../core/organ-registry/index.js";
import { createLinkManager } from "../../core/link-manager/index.js";

const target = { id: "voice-engine", public_api: ["speak"], dependencies: [] };
const source = {
  id: "chat-organ",
  public_api: ["send"],
  dependencies: [{ organ_id: "voice-engine", api: "speak" }],
};

test("registry validates unique ids and declared public APIs", () => {
  const registry = createOrganRegistry([target, source]);
  assert.equal(registry.has("voice-engine"), true);
  assert.equal(registry.resolve("voice-engine", "speak").api, "speak");
  assert.throws(() => createOrganRegistry([target, target]), /Duplicate organ id/);
  assert.throws(() => registry.resolve("voice-engine", "private"), /Undeclared public API/);
});

test("registry rejects missing targets and undeclared target APIs", () => {
  assert.throws(
    () => createOrganRegistry([{ ...source, dependencies: [{ organ_id: "missing", api: "go" }] }]),
    /unknown organ/,
  );
  assert.throws(
    () => createOrganRegistry([{ ...source, dependencies: [{ organ_id: "voice-engine", api: "private" }] }, target]),
    /does not expose public API/,
  );
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
  const manyTargets = Array.from({ length: 21 }, (_, index) => ({
    id: `target-${index}`, public_api: ["run"], dependencies: [],
  }));
  const manyDependencies = manyTargets.map((item) => ({ organ_id: item.id, api: "run" }));
  assert.throws(
    () => createOrganRegistry([...manyTargets, { id: "source-organ", public_api: [], dependencies: manyDependencies }]),
    /20-link dependency limit/,
  );
});
