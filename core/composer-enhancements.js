import { initializeComposerStopControl } from "./composer-stop.js";
import { initializeComposerAutoGrow } from "./composer-autogrow.js";

export function initializeComposerEnhancements() {
  if (typeof document === "undefined") return;
  const input = document.getElementById("input");
  const composer = document.getElementById("composer");
  const send = document.getElementById("sendBtn");
  if (!input || !composer || !send) return;

  initializeComposerStopControl(send);
  initializeComposerAutoGrow(input, composer);
  if (document.getElementById("composerExpandBtn")) return;

  const style = document.createElement("style");
  style.id = "chat-composer-expand-styles";
  style.textContent = [
    "#composer .row{gap:6px;align-items:flex-end}",
    "#composer .input{min-height:34px!important;padding-top:6px!important;padding-bottom:6px!important}",
    "#composerExpandBtn{display:none}",
    "#composerExpandBtn.visible{display:inline-grid}",
    ".mosharrof-expand-editor{position:fixed;inset:0;z-index:20000;display:none;flex-direction:column;background:#050505;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(14px + env(safe-area-inset-bottom,0px));color:#f5f5f5}",
    ".mosharrof-expand-editor.open{display:flex}",
    ".mosharrof-expand-head{display:flex;align-items:center;gap:8px;padding:4px 0 14px;border-bottom:1px solid rgba(255,255,255,.14)}",
    ".mosharrof-expand-title{flex:1;font-size:15px;font-weight:700}",
    ".mosharrof-expand-btn{min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:#171717;color:#f5f5f5;font-size:13px}",
    ".mosharrof-expand-apply{background:#f1f1f1;color:#111;border-color:#f1f1f1;font-weight:700}",
    ".mosharrof-expand-text{flex:1;width:100%;min-height:0;margin:14px 0;padding:14px;border:1px solid rgba(255,255,255,.15);border-radius:14px;outline:none;resize:none;background:#111;color:#f5f5f5;font-size:16px;line-height:1.7;font-family:inherit;overflow:auto}",
    ".mosharrof-expand-text:focus{border-color:rgba(255,255,255,.38)}",
    ".mosharrof-expand-hint{font-size:11px;color:#92929a;padding:0 2px 8px}",
    "@media(max-width:480px){#composer .input{padding-left:4px!important;padding-right:4px!important}#composer .composer-action,#composer .send{width:34px;height:34px}#composerExpandBtn svg{width:16px;height:16px}}"
  ].join("\n");
  document.head.appendChild(style);

  const expand = document.createElement("button");
  expand.className = "composer-action";
  expand.id = "composerExpandBtn";
  expand.type = "button";
  expand.setAttribute("aria-label", "বড় পর্দায় লেখা সম্পাদনা করুন");
  expand.title = "বড় পর্দায় লেখা খুলুন";
  expand.setAttribute("aria-controls", "mosharrofExpandEditor");
  expand.setAttribute("aria-expanded", "false");
  expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/><path d="M8 8h8v8H8z"/></svg>';
  // Preserve the established live composer order: expand action before the stop action.
  send.parentNode.insertBefore(expand, document.getElementById("stopBtn") || send);

  const editor = document.createElement("section");
  editor.className = "mosharrof-expand-editor";
  editor.id = "mosharrofExpandEditor";
  editor.setAttribute("role", "dialog");
  editor.setAttribute("aria-modal", "true");
  editor.setAttribute("aria-hidden", "true");
  editor.setAttribute("aria-labelledby", "mosharrofExpandTitle");
  editor.innerHTML = '<div class="mosharrof-expand-head"><div class="mosharrof-expand-title" id="mosharrofExpandTitle">বার্তা সম্পাদনা</div><button class="mosharrof-expand-btn" type="button" data-expand-cancel>ফিরে যান</button><button class="mosharrof-expand-btn mosharrof-expand-apply" type="button" data-expand-apply>লেখা ব্যবহার করুন</button></div><textarea class="mosharrof-expand-text" aria-label="সম্পূর্ণ বার্তা সম্পাদনা করুন" placeholder="এখানে আপনার সম্পূর্ণ বার্তা লিখুন..."></textarea><div class="mosharrof-expand-hint">সম্পাদিত লেখা মূল মেসেজ বক্সে নিতে “লেখা ব্যবহার করুন” চাপুন।</div>';
  document.body.appendChild(editor);
  const largeInput = editor.querySelector("textarea");

  function currentInput() {
    return document.getElementById("input") || input;
  }
  function syncVisibility() {
    const activeInput = currentInput();
    expand.classList.toggle("visible", !!String(activeInput.value || "").trim());
  }
  function openEditor() {
    const activeInput = currentInput();
    if (!String(activeInput.value || "").trim()) return;
    largeInput.value = activeInput.value;
    editor.classList.add("open");
    editor.setAttribute("aria-hidden", "false");
    expand.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      largeInput.focus();
      largeInput.setSelectionRange(largeInput.value.length, largeInput.value.length);
    });
  }
  function closeEditor(apply) {
    const activeInput = currentInput();
    if (apply) {
      const value = String(largeInput.value || "");
      activeInput.value = value;
      activeInput.dispatchEvent(new Event("input", { bubbles: true }));
      activeInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Some UI listeners may replace the composer input while handling the input event.
      // Reacquire by ID instead of writing a second time to a detached node.
      let latestInput = currentInput();
      if (latestInput !== activeInput) {
        latestInput.value = value;
        latestInput.dispatchEvent(new Event("input", { bubbles: true }));
        latestInput = currentInput();
      }
      latestInput.value = value;
      syncVisibility();
    }
    editor.classList.remove("open");
    editor.setAttribute("aria-hidden", "true");
    expand.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (apply) activeInput.focus();
  }

  document.addEventListener("input", event => {
    if (event.target?.id === "input") syncVisibility();
  });
  expand.addEventListener("click", openEditor);
  editor.querySelector("[data-expand-cancel]").addEventListener("click", () => closeEditor(false));
  editor.querySelector("[data-expand-apply]").addEventListener("click", event => {
    event.preventDefault();
    closeEditor(true);
  });
  editor.addEventListener("click", event => {
    if (event.target === editor) closeEditor(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && editor.classList.contains("open")) closeEditor(false);
  });
  syncVisibility();
}
