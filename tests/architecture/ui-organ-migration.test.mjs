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
import * as CoreOrgan from "../../organs/core/index.js";
import * as SidebarOrgan from "../../organs/sidebar/index.js";
import * as VoiceOrgan from "../../organs/voice/index.js";
import * as StorageOrgan from "../../organs/storage/index.js";
import * as ToolFactoryOrgan from "../../organs/tool-factory/index.js";
import * as QuranResearchOrgan from "../../organs/quran-research/index.js";

const uiOrgans = [HomeOrgan, ChatOrgan, HistoryOrgan, LibraryOrgan, ProjectOrgan, NotesOrgan, SettingsOrgan, QuranOrgan, ResearchOrgan, AiOrgan, BranchOrgan, CoreOrgan, SidebarOrgan, VoiceOrgan, StorageOrgan, ToolFactoryOrgan, QuranResearchOrgan];
test("each UI entity has a distinct manifest and runtime namespace", async () => {
  const artifact = JSON.parse(await readFile(new URL("../../web/runtime/organs.registry.json", import.meta.url), "utf8"));
  const registry = createOrganRegistry(artifact.organs);
  const runtime = createOrganRuntime({ registry, linkManager: createLinkManager(registry) });
  assert.equal(uiOrgans.length, 17);
  assert.equal(new Set(uiOrgans.map((organ) => organ.organId)).size, uiOrgans.length);
  for (const organ of uiOrgans) {
    const manifest = registry.get(organ.organId);
    assert.ok(manifest, "missing manifest for " + organ.organId);
    assert.deepEqual([...manifest.public_api].sort(), ["getHealth", "reportIssue"]);
    organ.initialize(runtime);
    runtime.register(organ.organId, {
      getHealth: () => organ.getHealth(runtime),
      reportIssue: (payload = {}) => organ.reportIssue(runtime, payload.summary ?? "test issue")
    });
    assert.equal(runtime.health(organ.organId).status, "ready");
  }
});

test("the live shell loads the organ runtime and maps every visible module", async () => {
  const html = await readFile(new URL("../../web/index.html", import.meta.url), "utf8");
  const bootstrap = await readFile(new URL("../../web/entities/organ-bootstrap.js", import.meta.url), "utf8");
  assert.ok(html.includes('<script type="module" src="./entities/bootstrap.js"></script>'));
  for (const mapping of [
    'core: "core"', 'chat: "chat"', 'sidebar: "sidebar"', 'voice: "voice"',
    'storage: "storage"', 'tool_factory: "tool-factory"', 'quran_research: "quran-research"'
  ]) assert.ok(bootstrap.includes(mapping), "missing visible UI organ mapping: " + mapping);
});
\ntest("one UI organ issue does not degrade another organ", () => {
  const records = uiOrgans.map((organ) => ({ id: organ.organId, public_api: ["getHealth", "reportIssue"], dependencies: [] }));
  const registry = createOrganRegistry(records);
  const runtime = createOrganRuntime({ registry, linkManager: createLinkManager(registry) });
  runtime.reportIssue("chat", "isolated test issue");
  assert.equal(runtime.health("chat").status, "degraded");
  assert.equal(runtime.health("notes").status, "registered");
  assert.equal(runtime.health("notes").issues, 0);
});
