import test from "node:test";
import assert from "node:assert/strict";
import { createOrganRegistry } from "../../core/organ-registry/index.js";
import { createLinkManager } from "../../core/link-manager/index.js";
import { createOrganRuntime } from "../../core/organ-runtime/index.js";
import { createJackboxControlBox } from "../../core/jackbox/index.js";

const addon = { id: "demo-addon", public_api: ["getHealth", "reportIssue", "ping"], dependencies: [] };
const caller = { id: "chat-organ", public_api: ["send"], dependencies: [{ organ_id: "demo-addon", api: "ping" }] };
const manifest = (enabled = false) => ({
  schema_version: 1,
  modules: [{ id: "demo-addon", path: "organs/demo-addon", entry: "organs/demo-addon/index.js", enabled }],
});
function makeHarness({ enabled = false, moduleFactory, reservedIds = [] } = {}) {
  const registry = createOrganRegistry([addon, caller]);
  const runtime = createOrganRuntime({ registry, linkManager: createLinkManager(registry) });
  let loadCount = 0;
  const box = createJackboxControlBox({
    manifest: manifest(enabled),
    registry,
    runtime,
    reservedIds,
    loadModule: async (id) => {
      assert.equal(id, "demo-addon");
      loadCount += 1;
      return moduleFactory ? moduleFactory() : {
        organId: id,
        initialize: async () => {},
        getHealth: (scoped) => scoped.health(),
        reportIssue: (scoped, summary) => scoped.reportIssue(summary),
        ping: async (_scoped, payload) => ({ pong: payload.value }),
        dispose: async () => {},
      };
    },
  });
  return { box, runtime, getLoadCount: () => loadCount };
}

test("disabled modules are not imported and cannot be invoked", async () => {
  const { box, runtime, getLoadCount } = makeHarness();
  const result = await box.initialize();
  assert.equal(result[0].status, "disabled");
  assert.equal(getLoadCount(), 0);
  assert.equal(runtime.isEnabled("demo-addon"), false);
  await assert.rejects(runtime.invoke("chat-organ", "demo-addon", "ping", { value: 1 }), /target organ is disabled/);
});

test("module can be enabled, invoked through its contract, and disabled with cleanup", async () => {
  let disposed = 0;
  const { box, runtime } = makeHarness({ moduleFactory: () => ({
    organId: "demo-addon",
    initialize: async () => {},
    getHealth: (scoped) => scoped.health(),
    reportIssue: (scoped, summary) => scoped.reportIssue(summary),
    ping: async (_scoped, payload) => ({ pong: payload.value }),
    dispose: async () => { disposed += 1; },
  }) });
  await box.initialize();
  assert.equal((await box.enable("demo-addon")).status, "enabled");
  assert.deepEqual(await runtime.invoke("chat-organ", "demo-addon", "ping", { value: "ok" }), { pong: "ok" });
  assert.equal((await box.disable("demo-addon")).status, "disabled");
  assert.equal(disposed, 1);
  assert.equal(runtime.isEnabled("demo-addon"), false);
  await assert.rejects(runtime.invoke("chat-organ", "demo-addon", "ping", {}), /target organ is disabled/);
});

test("failed attachment is quarantined and fails closed", async () => {
  const { box, runtime } = makeHarness({ moduleFactory: () => ({
    organId: "demo-addon",
    initialize: async () => { throw new Error("simulated init failure"); },
    getHealth: () => ({}),
    reportIssue: () => {},
    ping: () => ({}),
    dispose: async () => {},
  }) });
  await box.initialize();
  await assert.rejects(box.enable("demo-addon"), /simulated init failure/);
  assert.equal(box.list()[0].status, "quarantined");
  assert.equal(runtime.isEnabled("demo-addon"), false);
});

test("registry paths and reserved IDs are validated before loading", () => {
  const registry = createOrganRegistry([addon, caller]);
  const runtime = createOrganRuntime({ registry, linkManager: createLinkManager(registry) });
  assert.throws(() => createJackboxControlBox({
    manifest: { schema_version: 1, modules: [{ ...manifest().modules[0], entry: "https://bad.example/module.js" }] },
    registry, runtime, loadModule: async () => ({}),
  }), /paths must stay inside/);
  assert.throws(() => createJackboxControlBox({
    manifest: manifest(), registry, runtime, loadModule: async () => ({}), reservedIds: ["demo-addon"],
  }), /already loaded by the host/);
});
