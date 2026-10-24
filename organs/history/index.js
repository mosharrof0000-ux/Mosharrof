import { EntityRegistry } from "../../web/entities/core/entity-registry.js";
import { EntityBus } from "../../web/entities/core/entity-bus.js";
import { EntityState } from "../../web/entities/core/entity-state.js";
import { icons } from "../../web/entities/shared/entity-icons.js";
import { initializeHistoryUi } from "./history-ui.js";

export const organId = new URL(import.meta.url).pathname.split("/").slice(-2, -1)[0];
export function initialize(runtime) {
  EntityRegistry.register({
    id: organId, icon: icons[organId],
    bind(entity) {
      entity.el.dataset.shape = organId;
      entity.el.addEventListener("click", () => {
        EntityState.set(entity.id, "active");
        entity.el.dataset.state = "active";
        EntityBus.emit("entity:activated", { entity });
        setTimeout(() => {
          EntityState.set(entity.id, "idle");
          entity.el.dataset.state = "idle";
        }, 220);
      });
      EntityBus.on("entity:error", (payload) => {
        if (payload?.target === entity.id) {
          EntityState.set(entity.id, "error");
          entity.el.dataset.state = "error";
          runtime.reportIssue(organId, "UI entity reported an error");
        }
      });
    }
  });
  initializeHistoryUi();
  return Object.freeze({ id: organId, status: "initialized" });
}
export function getHealth(runtime) { return runtime.health(organId); }
export function reportIssue(runtime, summary = "organ issue reported") {
  return runtime.reportIssue(organId, summary);
}
