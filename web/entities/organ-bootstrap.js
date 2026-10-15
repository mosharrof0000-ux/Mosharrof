import { EntityRegistry } from "./core/entity-registry.js";
import { EntityBus } from "./core/entity-bus.js";
import { createOrganRegistry } from "../runtime/core/organ-registry/index.js";
import { createLinkManager } from "../runtime/core/link-manager/index.js";
import { createOrganRuntime } from "../runtime/core/organ-runtime/index.js";
import { uiOrgans } from "./organ-modules.js";

const moduleAliases = { tool_factory: "tool-factory", quran_research: "quran-research" };
const shapeRules = {
  home: "14px 10px 16px 11px", chat: "10px 16px 12px 16px", history: "50%",
  library: "8px 16px 10px 16px", project: "15px 8px 15px 8px",
  notes: "9px 15px 9px 15px", settings: "50%", quran: "12px 18px 9px 17px",
  research: "50% 12px 18px 12px", ai: "50%", branch: "18px 8px 18px 8px"
};
window.MosharrofEntitySystem = { registry: EntityRegistry, bus: EntityBus, version: "2.0-organ-runtime", ready: false };

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
  EntityBus.on("entity:activated", ({ entity }) => {
    entity.el.dataset.state = "active";
    if (registry.has(entity.id)) runtime.reportSuccess(entity.id, "UI entity activated");
  });
  document.querySelectorAll("[data-module]").forEach((element) => {
    const id = moduleAliases[element.dataset.module] || element.dataset.module;
    if (!registry.has(id)) {
      runtime.reportIssue("core", "unregistered navigation module");
      return;
    }
    element.dataset.organId = id;
    element.addEventListener("click", () => runtime.reportSuccess(id, "navigation module activated"));
  });
  window.MosharrofEntitySystem = {
    registry: EntityRegistry, bus: EntityBus, organRegistry: registry, links, organRuntime: runtime,
    version: "2.0-organ-runtime", ready: true
  };
  window.dispatchEvent(new CustomEvent("mosharrof:organs-ready", { detail: { count: registry.list().length } }));
}
startOrganRuntime().catch((error) => {
  console.error("[MOSHARROF Organ Runtime] startup blocked", error);
  window.MosharrofEntitySystem = { registry: EntityRegistry, bus: EntityBus, version: "2.0-organ-runtime", ready: false, error: "organ-runtime-startup-failed" };
});
