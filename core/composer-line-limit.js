/** Measure and enforce the composer eight-line visual limit. */
export function resizeComposerToEightLines(input) {
  const css = window.getComputedStyle(input);
  const lineHeight = parseFloat(css.lineHeight) || 24;
  const padding = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
  const borders = (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.borderBottomWidth) || 0);
  const minHeight = Math.ceil(lineHeight + padding + borders);
  const maxHeight = Math.ceil(lineHeight * 8 + padding + borders);
  input.style.maxHeight = maxHeight + "px";
  input.style.height = "auto";
  input.style.height = Math.min(Math.max(minHeight, input.scrollHeight), maxHeight) + "px";
  const overLimit = input.scrollHeight > maxHeight + 1;
  input.classList.toggle("is-over-eight-lines", overLimit);
  input.scrollTop = input.scrollHeight;
  input.dispatchEvent(new CustomEvent("composer:line-limit", {
    bubbles: true, detail: { overLimit, maxLines: 8 }
  }));
}
