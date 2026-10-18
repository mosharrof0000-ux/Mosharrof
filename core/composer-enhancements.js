import { initializeComposerStopControl } from "./composer-stop.js";
import { initializeComposerAutoGrow } from "./composer-autogrow.js";

export function initializeComposerEnhancements() {
  if (typeof document === "undefined") return;
  const input = document.getElementById("input");
  const composer = document.getElementById("composer");
  const send = document.getElementById("sendBtn");
  if (!input || !composer || !send) return;

  // Explicit phone-command handoff: MOSHARROF chat remains the command entry point.
  // Android still validates the command and requires local confirmation before execution.
  let lastHandoffKey = "";
  let lastHandoffAt = 0;
  function handoffPhoneCommand() {
    const raw = String(input.value || "").trim();
    const match = raw.match(/^(?:মোশাররফ[ ,،]*)?(?:ফোনে করো|ফোনে|@ফোন|@phone)\s*[:：-]\s*(.+)$/i);
    if (!match || !match[1].trim()) return;
    const command = match[1].trim();
    if (command.length > 240) {
      input.setCustomValidity("ফোনের নির্দেশ ২৪০ অক্ষরের মধ্যে রাখুন।");
      input.reportValidity();
      input.setCustomValidity("");
      return;
    }
    const key = command;
    const now = Date.now();
    if (key === lastHandoffKey && now - lastHandoffAt < 1400) return;
    lastHandoffKey = key;
    lastHandoffAt = now;
    const link = document.createElement("a");
    link.href = "mosharrof://device-control?command=" + encodeURIComponent(command);
    link.setAttribute("aria-hidden", "true");
    link.tabIndex = -1;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => link.remove(), 1000);
  }
  send.addEventListener("click", handoffPhoneCommand, true);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) handoffPhoneCommand();
  }, true);
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
  send.parentNode.insertBefore(expand, send);

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

  function syncVisibility() {
    expand.classList.toggle("visible", !!String(input.value || "").trim());
  }
  function openEditor() {
    if (!String(input.value || "").trim()) return;
    largeInput.value = input.value;
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
    if (apply) {
      input.value = largeInput.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.value = largeInput.value;
      syncVisibility();
    }
    editor.classList.remove("open");
    editor.setAttribute("aria-hidden", "true");
    expand.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (apply) input.focus();
  }

  input.addEventListener("input", syncVisibility);
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
