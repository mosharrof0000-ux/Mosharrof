import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createOrganRegistry } from "../../core/organ-registry/index.js";
import { createLinkManager } from "../../core/link-manager/index.js";
import { createOrganRuntime } from "../../core/organ-runtime/index.js";
import * as HomeOrgan from "../../organs/home/index.js";
import * as ChatOrgan from "../../organs/chat/index.js";
import * as HistoryOrgan from "../../organs/history/index.js";
import * as LibraryOrgan from "../../organs/library/index.js";
import * as ProjectOrgan from "../../organs/project/index.js";
import * as NotesOrgan from "../../organs/notes/index.js";
import * as SettingsOrgan from "../../organs/settings/index.js";
import * as QuranOrgan from "../../organs/quran/index.js";
import * as ResearchOrgan from "../../organs/research/index.js";
import * as AiOrgan from "../../organs/ai/index.js";
import * as BranchOrgan from "../../organs/branch/index.js";

const uiOrgans = [HomeOrgan, ChatOrgan, HistoryOrgan, LibraryOrgan, ProjectOrgan, NotesOrgan, SettingsOrgan, QuranOrgan, ResearchOrgan, AiOrgan, BranchOrgan];
test("each UI entity has a distinct manifest and runtime namespace", async () => {
  const artifact = JSON.parse(await readFile(new URL("../../web/runtime/organs.registry.json", import.meta.url), "utf8"));
  const registry = createOrganRegistry(artifact.organs);
  const runtime = createOrganRuntime({ registry, linkManager: createLinkManager(registry) });
  assert.equal(uiOrgans.length, 11);
  assert.equal(new Set(uiOrgans.map((organ) => organ.organId)).size, uiOrgans.length);
  for (const organ of uiOrgans) {
    const manifest = registry.get(organ.organId);
    assert.ok(manifest, "missing manifest for " + organ.organId);
    assert.deepEqual([...manifest.public_api].sort(), ["getHealth", "reportIssue"]);
    const scoped = runtime.forOrgan(organ.organId);
    organ.initialize(scoped);
    scoped.register({
      getHealth: () => organ.getHealth(scoped),
      reportIssue: (payload = {}) => organ.reportIssue(scoped, payload.summary ?? "test issue")
    });
    assert.equal(scoped.health().status, "ready");
  }
});
test("one UI organ issue does not degrade another organ", () => {
  const records = uiOrgans.map((organ) => ({ id: organ.organId, public_api: ["getHealth", "reportIssue"], dependencies: [] }));
  const registry = createOrganRegistry(records);
  const runtime = createOrganRuntime({ registry, linkManager: createLinkManager(registry) });
  runtime.forOrgan("chat").reportIssue("isolated test issue");
  assert.equal(runtime.health("chat").status, "degraded");
  assert.equal(runtime.health("notes").status, "registered");
  assert.equal(runtime.health("notes").issues, 0);
});
