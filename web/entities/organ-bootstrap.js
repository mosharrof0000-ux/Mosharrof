import { EntityRegistry } from "./core/entity-registry.js";
import { EntityBus } from "./core/entity-bus.js";
import { createOrganRegistry } from "../runtime/core/organ-registry/index.js";
import { createLinkManager } from "../runtime/core/link-manager/index.js";
import { createOrganRuntime } from "../runtime/core/organ-runtime/index.js";
import { initializeJackbox } from "./jackbox-bootstrap.js";
import * as HomeOrgan from "../organs/home/index.js";
import * as ChatOrgan from "../organs/chat/index.js";
import * as HistoryOrgan from "../organs/history/index.js";
import * as LibraryOrgan from "../organs/library/index.js";
import * as ProjectOrgan from "../organs/project/index.js";
import * as NotesOrgan from "../organs/notes/index.js";
import * as SettingsOrgan from "../organs/settings/index.js";
import * as QuranOrgan from "../organs/quran/index.js";
import * as ResearchOrgan from "../organs/research/index.js";
import * as AiOrgan from "../organs/ai/index.js";
import * as BranchOrgan from "../organs/branch/index.js";
import { extraUiOrgans } from "./ui-organ-modules.js";
import { installDrawerStateGuard } from "../core/drawer-state-guard.js";

const shapeRules = {
  home: "14px 10px 16px 11px", chat: "10px 16px 12px 16px", history: "50%",
  library: "8px 16px 10px 16px", project: "15px 8px 15px 8px",
  notes: "9px 15px 9px 15px", settings: "50%", quran: "12px 18px 9px 17px",
  research: "50% 12px 18px 12px", ai: "50%", branch: "18px 8px 18px 8px"
};
const uiOrgans = [HomeOrgan, ChatOrgan, HistoryOrgan, LibraryOrgan, ProjectOrgan, NotesOrgan, SettingsOrgan, QuranOrgan, ResearchOrgan, AiOrgan, BranchOrgan, ...extraUiOrgans];
window.MosharrofEntitySystem = { registry: EntityRegistry, bus: EntityBus, version: "2.0-organ-runtime", ready: false };

installDrawerStateGuard();

async function startOrganRuntime() {
  const response = await fetch(new URL("../runtime/organs.registry.json", import.meta.url), { cache: "no-store" });
  if (!response.ok) throw new Error("Organ manifest registry unavailable: HTTP " + response.status);
  const manifestData = await response.json();
  const registry = createOrganRegistry(manifestData.organs);
  const links = createLinkManager(registry);
  let storage = null;
  try {
    storage = window.localStorage;
    const probe = "mosharrof:organ-memory:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
  } catch { storage = null; }
  const runtime = createOrganRuntime({ registry, linkManager: links, storage });
  for (const organ of uiOrgans) {
    const scoped = runtime.forOrgan(organ.organId);
    organ.initialize(scoped);
    scoped.register({
      getHealth: () => organ.getHealth(scoped),
      reportIssue: (payload = {}) => organ.reportIssue(scoped, payload.summary ?? "issue reported by authorized caller")
    });
  }
  document.querySelectorAll("[data-ui-entity]").forEach((element) => {
    const id = element.dataset.uiEntity;
    if (shapeRules[id]) element.style.borderRadius = shapeRules[id];
    try {
      EntityRegistry.mount(element, id, { surface: element.closest("[data-surface]")?.dataset.surface || "site" });
    } catch (error) {
      console.error("[MOSHARROF Entity Bootstrap]", id, error);
      if (registry.has(id)) runtime.reportIssue(id, "entity mount failed");
    }
  });
  // The current shell uses data-module. Connect visible controls without replacing their DOM.
  const moduleToOrgan = Object.freeze({
    core: "core", chat: "chat", sidebar: "sidebar", voice: "voice",
    storage: "storage", tool_factory: "tool-factory", quran_research: "quran-research"
  });
  document.querySelectorAll("[data-module]").forEach((element) => {
    const id = moduleToOrgan[element.dataset.module];
    if (!id || !registry.has(id)) return;
    element.dataset.organId = id;
    element.addEventListener("click", () => runtime.reportSuccess(id, "UI module activated"));
  });
  EntityBus.on("entity:activated", ({ entity }) => {
    entity.el.dataset.state = "active";
    if (registry.has(entity.id)) runtime.reportSuccess(entity.id, "UI entity activated");
  });
  const jackbox = await initializeJackbox({
    registry, runtime, reservedIds: uiOrgans.map((organ) => organ.organId)
  });
  window.MosharrofEntitySystem = {
    registry: EntityRegistry, bus: EntityBus, organRegistry: registry, links, organRuntime: runtime, jackbox,
    version: "2.1-organ-runtime-jackbox", ready: true
  };
  window.dispatchEvent(new CustomEvent("mosharrof:organs-ready", { detail: { count: registry.list().length } }));
}
startOrganRuntime().catch((error) => {
  console.error("[MOSHARROF Organ Runtime] startup blocked", error);
  window.MosharrofEntitySystem = { registry: EntityRegistry, bus: EntityBus, version: "2.0-organ-runtime", ready: false, error: "organ-runtime-startup-failed" };
});
