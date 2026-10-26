(function () {
  "use strict";
  const loaderUrl = document.currentScript && document.currentScript.src;
  if (!loaderUrl || window.__mosharrofVideoCuttingRequested) return;
  window.__mosharrofVideoCuttingRequested = true;

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("./styles.css", loaderUrl).href;
  document.head.appendChild(css);

  const download = document.createElement("script");
  download.src = new URL("./download.js", loaderUrl).href;
  download.addEventListener("load", function () {
    const ui = document.createElement("script");
    ui.src = new URL("./ui.js", loaderUrl).href;
    ui.addEventListener("error", function () {
      console.error("[MOSHARROF Video Cutting] UI module failed to load");
    }, { once: true });
    document.body.appendChild(ui);
  }, { once: true });
  download.addEventListener("error", function () {
    console.error("[MOSHARROF Video Cutting] download module failed to load");
  }, { once: true });
  document.body.appendChild(download);
})();
