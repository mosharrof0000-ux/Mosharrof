/** Runtime composer layout and safe draft recovery; keep web/index.html frozen. */
export function initializeComposerLayout(input, composer, send) {
  if (!input || !composer || !send || composer.dataset.stackedLayoutReady === "true") return;
  composer.dataset.stackedLayoutReady = "true";
  let inputRow = composer.querySelector(".composer-input-row");
  let actionsRow = composer.querySelector(".composer-actions-row");
  if (!inputRow || !actionsRow) {
    const existingRow = input.closest(".row");
    if (!existingRow || existingRow.parentElement !== composer) return;
    inputRow = document.createElement("div");
    inputRow.className = "composer-input-row";
    composer.insertBefore(inputRow, existingRow);
    inputRow.appendChild(input);
    existingRow.classList.add("composer-actions-row");
    actionsRow = existingRow;
  }
  if (!document.getElementById("composer-layout-styles")) {
    const style = document.createElement("style");
    style.id = "composer-layout-styles";
    style.textContent = [
      "#composer{display:flex;flex-direction:column;gap:7px}",
      "#composer .composer-input-row{display:flex;align-items:stretch;width:100%;min-width:0}",
      "#composer .composer-input-row{flex:0 0 100%;box-sizing:border-box}",
      "#composer .composer-input-row .input{display:block;box-sizing:border-box;width:100%;flex:1 1 100%;min-width:0;min-height:88px!important;height:88px;max-height:min(44dvh,360px);padding:12px 8px;line-height:1.5;overflow-y:auto;overscroll-behavior:contain}",
      "#composer .composer-actions-row{width:100%;box-sizing:border-box}",
      "#composerServerBtn{position:relative;flex:none}",
      "#composer .composer-actions-row{display:flex;align-items:center;gap:6px;min-height:36px}",
      "#composerTools{margin-right:auto}",
      "#composerVoiceBtn.is-listening{background:#080808;border-color:rgba(255,255,255,.16);color:#f2f2f2;box-shadow:none}",
      "#composerVoiceBtn.is-listening svg{animation:none}",
      "#composerVoiceBtn.has-voice-activity svg{stroke:#4ade80;filter:drop-shadow(0 0 2px rgba(74,222,128,.35));transform-origin:50% 50%;animation:voice-mic-bob .24s ease-in-out infinite alternate}",
      "#composerVoiceBtn.has-voice-activity{background:#080808;border-color:rgba(255,255,255,.16);box-shadow:none}",
      "#sendBtn svg{stroke:var(--chat-provider-accent,#f2f2f2)!important}",
      "@media(max-width:480px){#composer{left:10px;right:10px;padding:8px 9px}#composer .composer-input-row .input{padding-left:4px;padding-right:4px}}"
    ].join("\n");
    document.head.appendChild(style);
  }
  let submittedDraft = "";
  let draftVersion = 0;
  let submittedDraftVersion = 0;
  input.addEventListener("input", () => { draftVersion += 1; }, true);
  function rememberDraft() {
    if (!input.value.trim()) return;
    submittedDraft = input.value;
    submittedDraftVersion = draftVersion;
  }
  send.addEventListener("click", rememberDraft, true);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) rememberDraft();
  }, true);
  const messages = document.getElementById("messages");
  if (messages && typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(records => {
      if (!submittedDraft || input.value.trim()) return;
      const added = records.flatMap(record => Array.from(record.addedNodes)).filter(node => node.nodeType === 1);
      const error = added.some(node => node.matches?.(".message.ai:not(.typing)") && node.querySelector(".response-timer.is-error"));
      const answer = added.some(node => node.matches?.(".message.ai:not(.typing)") && !node.querySelector(".response-timer.is-error"));
      if (error && draftVersion === submittedDraftVersion) {
        input.value = submittedDraft;
        submittedDraft = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      } else if (answer) submittedDraft = "";
    });
    observer.observe(messages, { childList: true, subtree: true });
  }
}
