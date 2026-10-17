/** Grow the full-width composer textarea to at most eight visual lines. */
export function initializeComposerAutoGrow(input, composer) {
  if (!input || !composer || input.dataset.mosharrofAutogrowReady) return;
  input.dataset.mosharrofAutogrowReady = "true";

  const style = document.createElement("style");
  style.id = "mosharrof-composer-autogrow-style";
  style.textContent = [
    "#composer .input{line-height:24px!important;overflow-y:hidden;resize:none;white-space:pre-wrap;overflow-wrap:anywhere;overscroll-behavior:contain;scrollbar-width:thin}",
    "#composer .input.is-over-eight-lines{overflow-y:auto!important}"
  ].join("\n");
  document.head.appendChild(style);

  function getLimits() {
    const css = window.getComputedStyle(input);
    const lineHeight = parseFloat(css.lineHeight) || 24;
    const verticalPadding = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
    const verticalBorders = (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.borderBottomWidth) || 0);
    return {
      minHeight: Math.ceil(lineHeight + verticalPadding + verticalBorders),
      maxHeight: Math.ceil(lineHeight * 8 + verticalPadding + verticalBorders)
    };
  }

  function resizeComposer() {
    const limits = getLimits();
    input.style.maxHeight = limits.maxHeight + "px";
    input.style.height = "auto";
    input.style.height = Math.min(Math.max(limits.minHeight, input.scrollHeight), limits.maxHeight) + "px";
    const overLimit = input.scrollHeight > limits.maxHeight + 1;
    input.classList.toggle("is-over-eight-lines", overLimit);
    input.scrollTop = input.scrollHeight;
    input.dispatchEvent(new CustomEvent("composer:line-limit", {
      bubbles: true,
      detail: { overLimit: overLimit, maxLines: 8 }
    }));
  }

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
