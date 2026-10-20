import { EntityRegistry } from "../../web/entities/core/entity-registry.js";
import { EntityBus } from "../../web/entities/core/entity-bus.js";
import { EntityState } from "../../web/entities/core/entity-state.js";
import { icons } from "../../web/entities/shared/entity-icons.js";

export const organId = (function(parts){return parts[parts.length-2]})(new URL(import.meta.url).pathname.split("/"));
if(typeof document!=="undefined"&&!document.getElementById("android-chat-layout")){var s=document.createElement("link");s.id="android-chat-layout";s.rel="stylesheet";s.href=new URL("../../runtime/android-edge-to-edge.css",import.meta.url).href;document.head.appendChild(s)}
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
  return Object.freeze({ id: organId, status: "initialized" });
}
export function getHealth(runtime) { return runtime.health(organId); }
export function reportIssue(runtime, summary = "organ issue reported") {
  return runtime.reportIssue(organId, summary);
}
