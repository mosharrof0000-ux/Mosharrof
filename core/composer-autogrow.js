/**
 * Viewport-aware auto-growth for the existing MOSHARROF message textarea.
 * Grows with text, then scrolls internally while keeping the newest line visible.
 */
export function initializeComposerAutoGrow(input, composer) {
  if (!input || !composer || input.dataset.mosharrofAutogrowReady) return;
  input.dataset.mosharrofAutogrowReady = "true";

  const style = document.createElement("style");
  style.id = "mosharrof-composer-autogrow-style";
  style.textContent = [
    "#composer .input{max-height:min(44dvh,360px)!important;line-height:1.5;overscroll-behavior:contain;scrollbar-width:thin}",
    "#composer .row{align-items:flex-end}"
  ].join("\n");
  document.head.appendChild(style);

  function resizeComposer() {
    const viewport = window.visualViewport;
    const visibleHeight = viewport && viewport.height > 0
      ? viewport.height
      : (window.innerHeight || document.documentElement.clientHeight || 640);
    const maxHeight = Math.max(72, Math.min(visibleHeight * 0.44, 360));
    input.style.maxHeight = maxHeight + "px";
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, maxHeight) + "px";
    input.scrollTop = input.scrollHeight;
  }

  function syncComposerViewport() {
    const viewport = window.visualViewport;
    if (viewport) {
      const keyboardGap = Math.max(
        0,
        (window.innerHeight || viewport.height) - (viewport.offsetTop + viewport.height)
      );
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
