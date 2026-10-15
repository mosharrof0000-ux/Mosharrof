// Keep the legacy shell's drawers mutually exclusive without editing its frozen entrypoint.
export function installDrawerStateGuard() {
  const left = document.querySelector("#drawerLeft");
  const right = document.querySelector("#drawerRight");
  const scrim = document.querySelector("#scrim");
  if (!left || !right || !scrim) return;
  document.addEventListener("click", (event) => {
    const target = event.target?.closest?.("button, #scrim");
    if (!target) return;
    if (target.id === "leftBtn" || target.id === "historyBtn") {
      right.classList.remove("open");
      right.setAttribute("aria-hidden", "true");
      left.setAttribute("aria-hidden", "false");
    } else if (target.id === "rightBtn") {
      left.classList.remove("open");
      left.setAttribute("aria-hidden", "true");
      right.setAttribute("aria-hidden", "false");
    } else if (["cL", "cR", "scrim", "historyNewChat", "newChat", "clearMsg"].includes(target.id)) {
      left.setAttribute("aria-hidden", "true");
      right.setAttribute("aria-hidden", "true");
    }
  }, true);
}
