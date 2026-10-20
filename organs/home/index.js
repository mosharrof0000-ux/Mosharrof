import { EntityRegistry } from "../../web/entities/core/entity-registry.js";
import { EntityBus } from "../../web/entities/core/entity-bus.js";
import { EntityState } from "../../web/entities/core/entity-state.js";
import { icons } from "../../web/entities/shared/entity-icons.js";

export const organId = (function(parts){return parts[parts.length-2]})(new URL(import.meta.url).pathname.split("/"));
if (typeof document !== "undefined" && !document.querySelector('style[data-mosharrof-android-chat-layout]')) {
  const layoutStyle = document.createElement("style");
  layoutStyle.dataset.mosharrofAndroidChatLayout = "true";
  layoutStyle.textContent = "html,body,.content,.hero,#chatScroll{min-width:0;max-width:100%;box-sizing:border-box}#chatScroll{width:100%;left:0;right:0}#messages,.messages{display:flex;flex-direction:column;width:100%;max-width:900px;min-width:0;align-self:stretch;flex:0 0 auto;box-sizing:border-box}#messages>.message.ai,.messages>.message.ai{width:100%;max-width:760px;min-width:0;align-self:flex-start;box-sizing:border-box}#messages>.message.ai>.rich-content,.messages>.message.ai>.rich-content{display:block;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow-wrap:anywhere}";
  document.head.appendChild(layoutStyle);
}
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
