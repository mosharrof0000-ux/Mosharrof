import { resizeComposerToEightLines } from "./composer-line-limit.js";

/** Grow the full-width composer naturally, then scroll within its eight-line cap. */
export function initializeComposerAutoGrow(input, composer) {
  if (!input || !composer || input.dataset.mosharrofAutogrowReady) return;
  input.dataset.mosharrofAutogrowReady = "true";
  const style = document.createElement("style");
  style.id = "mosharrof-composer-autogrow-style";
  style.textContent = "#composer .input{line-height:24px!important;overflow-y:hidden;resize:none;white-space:pre-wrap;overflow-wrap:anywhere;overscroll-behavior:contain;scrollbar-width:thin}#composer .input.is-over-eight-lines{overflow-y:auto!important}";
  document.head.appendChild(style);
  function resizeComposer() { resizeComposerToEightLines(input); }
  function syncComposerViewport() {
    const viewport = window.visualViewport;
    if (viewport) {
      const keyboardGap = Math.max(0, (window.innerHeight || viewport.height) - (viewport.offsetTop + viewport.height));
      composer.style.bottom = keyboardGap > 100 ? (keyboardGap + 8) + "px" : "";
    }
    resizeComposer();
  }
  input.addEventListener("input", resizeComposer);
  input.addEventListener("focus", syncComposerViewport);
  window.addEventListener("resize", syncComposerViewport, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncComposerViewport, { passive: true });
    window.visualViewport.addEventListener("scroll", syncComposerViewport, { passive: true });
  }
  syncComposerViewport();
}
