/* Standalone live composer expansion control; intentionally dependency-free for Pages/PWA. */
(function () {
  "use strict";
  function init() {
    var input = document.getElementById("input");
    var composer = document.getElementById("composer");
    var send = document.getElementById("sendBtn");
    if (!input || !composer || !send || document.getElementById("composerExpandBtn")) return;

    var style = document.createElement("style");
    style.id = "composer-expansion-styles";
    style.textContent = [
      "#composerExpandBtn{display:none;align-items:center;justify-content:center}",
      "#composerExpandBtn.visible{display:inline-flex}",
      "#mosharrofExpandEditor{position:fixed;inset:0;z-index:20000;display:none;flex-direction:column;box-sizing:border-box;background:#050505;color:#f5f5f5;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(14px + env(safe-area-inset-bottom,0px))}",
      "#mosharrofExpandEditor.open{display:flex}",
      ".mosharrof-expand-head{display:flex;align-items:center;gap:8px;padding:4px 0 14px;border-bottom:1px solid rgba(255,255,255,.14)}",
      ".mosharrof-expand-title{flex:1;font-size:15px;font-weight:700}",
      ".mosharrof-expand-btn{min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:#171717;color:#f5f5f5;font-size:13px}",
      ".mosharrof-expand-apply{background:#f1f1f1;color:#111;border-color:#f1f1f1;font-weight:700}",
      ".mosharrof-expand-text{box-sizing:border-box;flex:1;width:100%;min-height:0;margin:14px 0;padding:14px;border:1px solid rgba(255,255,255,.15);border-radius:14px;outline:none;resize:none;background:#111;color:#f5f5f5;font-size:16px;line-height:1.7;font-family:inherit;overflow:auto}",
      ".mosharrof-expand-hint{font-size:11px;color:#92929a;padding:0 2px 8px}"
    ].join("\n");
    document.head.appendChild(style);

    var expand = document.createElement("button");
    expand.className = "composer-action";
    expand.id = "composerExpandBtn";
    expand.type = "button";
    expand.setAttribute("aria-label", "বড় পর্দায় লেখা সম্পাদনা করুন");
    expand.title = "বড় পর্দায় লেখা খুলুন";
    expand.setAttribute("aria-controls", "mosharrofExpandEditor");
    expand.setAttribute("aria-expanded", "false");
    expand.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    var voice = document.getElementById("composerVoiceBtn");
    send.parentNode.insertBefore(expand, voice || document.getElementById("stopBtn") || send);

    var editor = document.createElement("section");
    editor.id = "mosharrofExpandEditor";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-modal", "true");
    editor.setAttribute("aria-hidden", "true");
    editor.setAttribute("aria-labelledby", "mosharrofExpandTitle");
    editor.innerHTML = '<div class="mosharrof-expand-head"><div class="mosharrof-expand-title" id="mosharrofExpandTitle">বার্তা সম্পাদনা</div><button class="mosharrof-expand-btn" type="button" data-expand-cancel>ফিরে যান</button><button class="mosharrof-expand-btn mosharrof-expand-apply" type="button" data-expand-apply>লেখা ব্যবহার করুন</button></div><textarea class="mosharrof-expand-text" aria-label="সম্পূর্ণ বার্তা সম্পাদনা করুন" placeholder="এখানে আপনার সম্পূর্ণ বার্তা লিখুন..."></textarea><div class="mosharrof-expand-hint">সম্পাদিত লেখা মূল মেসেজ বক্সে নিতে “লেখা ব্যবহার করুন” চাপুন।</div>';
    document.body.appendChild(editor);
    var largeInput = editor.querySelector("textarea");

    function currentInput() { return document.getElementById("input") || input; }
    function syncVisibility() {
      var activeInput = currentInput();
      var overLimit = String(activeInput.value || "").split("\n").length > 8;
      expand.classList.toggle("visible", overLimit);
      expand.setAttribute("aria-hidden", overLimit ? "false" : "true");
    }
    function closeEditor(apply) {
      var activeInput = currentInput();
      if (apply) {
        activeInput.value = largeInput.value;
        activeInput.dispatchEvent(new Event("input", { bubbles: true }));
        activeInput.dispatchEvent(new Event("change", { bubbles: true }));
        activeInput = currentInput();
        syncVisibility();
      }
      editor.classList.remove("open");
      editor.setAttribute("aria-hidden", "true");
      expand.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (apply) activeInput.focus();
    }
    expand.addEventListener("click", function () {
      var activeInput = currentInput();
      if (!String(activeInput.value || "").trim()) return;
      largeInput.value = activeInput.value;
      editor.classList.add("open");
      editor.setAttribute("aria-hidden", "false");
      expand.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      largeInput.focus();
      largeInput.setSelectionRange(largeInput.value.length, largeInput.value.length);
    });
    editor.querySelector("[data-expand-cancel]").addEventListener("click", function () { closeEditor(false); });
    editor.querySelector("[data-expand-apply]").addEventListener("click", function (event) {
      event.preventDefault();
      closeEditor(true);
    });
    editor.addEventListener("click", function (event) { if (event.target === editor) closeEditor(false); });
    document.addEventListener("input", function (event) { if (event.target && event.target.id === "input") syncVisibility(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && editor.classList.contains("open")) closeEditor(false); });
    syncVisibility();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
