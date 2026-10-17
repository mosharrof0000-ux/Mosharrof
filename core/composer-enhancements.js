import { initializeComposerStopControl } from "./composer-stop.js";
import { initializeComposerAutoGrow } from "./composer-autogrow.js";
import { initializeComposerVoiceMeter } from "./composer-voice-meter.js";

export function initializeComposerEnhancements() {
  if (typeof document === "undefined") return;
  const input = document.getElementById("input");
  const composer = document.getElementById("composer");
  const send = document.getElementById("sendBtn");
  if (!input || !composer || !send) return;

  initializeComposerStopControl(send);
  initializeComposerAutoGrow(input, composer);
  initializeComposerVoiceMeter(document.getElementById("composerVoiceBtn"));

  // Long-press the existing Send control to choose a provider; a normal tap still sends.
  const providers = [
    {value:"auto",label:"স্বয়ংক্রিয় fallback",color:"#f2f2f2"},
    {value:"gemini",label:"Gemini",color:"#8ab4f8"},
    {value:"cloudflare-workers-ai",label:"Cloudflare Workers AI",color:"#f38020"},
    {value:"groq",label:"Groq",color:"#ff6b6b"},
    {value:"openrouter",label:"OpenRouter",color:"#b6a0ff"}
  ];
  const providerKey = "mosharrof_chat_provider_v1";
  const getProvider = () => { try { const v=localStorage.getItem(providerKey)||"auto"; return providers.some(p=>p.value===v)?v:"auto"; } catch { return "auto"; } };
  let serverMenu=document.getElementById("composerServerMenu");
  if(!serverMenu){
    serverMenu=document.createElement("div");serverMenu.id="composerServerMenu";serverMenu.className="composer-server-menu";serverMenu.setAttribute("role","menu");serverMenu.setAttribute("aria-label","সার্ভার নির্বাচন");
    const heading=document.createElement("div");heading.className="composer-server-menu-title";heading.textContent="সার্ভার নির্বাচন";serverMenu.appendChild(heading);
    providers.forEach(p=>{const b=document.createElement("button");b.type="button";b.className="composer-server-option";b.dataset.provider=p.value;b.setAttribute("role","menuitemradio");b.innerHTML='<span class="composer-server-dot"></span><span class="composer-server-label"></span><span class="composer-server-check">✓</span>';b.querySelector(".composer-server-label").textContent=p.label;b.querySelector(".composer-server-dot").style.background=p.color;b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();try{localStorage.setItem(providerKey,p.value);}catch{}applyProvider(p.value);closeServerMenu();window.dispatchEvent(new CustomEvent("mosharrof:chat-provider-change",{detail:{provider:p.value}}));});serverMenu.appendChild(b);});
    composer.appendChild(serverMenu);
  }
  function applyProvider(value){const p=providers.find(x=>x.value===value)||providers[0];send.style.setProperty("--server-accent",p.color);send.title="মেসেজ পাঠান · সার্ভার: "+p.label;send.setAttribute("aria-label","মেসেজ পাঠান · সার্ভার: "+p.label);serverMenu.querySelectorAll("[data-provider]").forEach(b=>{const active=b.dataset.provider===p.value;b.setAttribute("aria-checked",active?"true":"false");b.classList.toggle("selected",active);});}
  function openServerMenu(){applyProvider(getProvider());serverMenu.classList.add("open");send.setAttribute("aria-expanded","true");}
  function closeServerMenu(){serverMenu.classList.remove("open");send.setAttribute("aria-expanded","false");}
  applyProvider(getProvider());
  if(send.dataset.serverLongPressReady!=="true"){
    send.dataset.serverLongPressReady="true";let timer=0,startX=0,startY=0,suppress=false;
    const cancel=()=>{if(timer)window.clearTimeout(timer);timer=0;};
    send.addEventListener("pointerdown",e=>{if(e.button!==undefined&&e.button!==0)return;startX=e.clientX;startY=e.clientY;cancel();timer=window.setTimeout(()=>{timer=0;suppress=true;openServerMenu();},520);},{passive:true});
    send.addEventListener("pointermove",e=>{if(Math.abs(e.clientX-startX)>10||Math.abs(e.clientY-startY)>10)cancel();},{passive:true});
    send.addEventListener("pointerup",()=>{cancel();window.setTimeout(()=>{suppress=false;},0);},{passive:true});
    send.addEventListener("pointercancel",()=>{cancel();window.setTimeout(()=>{suppress=false;},0);},{passive:true});
    send.addEventListener("click",e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
    send.addEventListener("contextmenu",e=>{e.preventDefault();openServerMenu();});
    document.addEventListener("click",e=>{if(!serverMenu.contains(e.target)&&e.target!==send&&!send.contains(e.target))closeServerMenu();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")closeServerMenu();});
  }
  if(!document.getElementById("composer-server-menu-styles")){const st=document.createElement("style");st.id="composer-server-menu-styles";st.textContent="#composerServerMenu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:20001;display:none;flex-direction:column;gap:3px;width:min(280px,calc(100vw - 28px));padding:8px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:#101010;box-shadow:0 12px 36px rgba(0,0,0,.55)}#composerServerMenu.open{display:flex}.composer-server-menu-title{padding:5px 8px 8px;color:#a1a1aa;font-size:11px;font-weight:700}.composer-server-option{display:flex;align-items:center;gap:9px;min-height:40px;width:100%;padding:7px 9px;border:1px solid transparent;border-radius:9px;background:transparent;color:#f5f5f5;text-align:left;font-size:13px}.composer-server-option.selected{border-color:rgba(255,255,255,.18);background:#1b1b1b}.composer-server-dot{width:9px;height:9px;flex:none;border-radius:50%}.composer-server-label{flex:1}.composer-server-check{visibility:hidden}.composer-server-option.selected .composer-server-check{visibility:visible}#sendBtn svg{stroke:var(--server-accent,#f2f2f2)!important}";document.head.appendChild(st);}

  if (!document.getElementById("composer-layout-styles")) {
    const layoutStyle = document.createElement("style");
    layoutStyle.id = "composer-layout-styles";
    layoutStyle.textContent = [
      "#composer{display:flex;flex-direction:column;gap:7px}",
      
      "#composer>.input{display:block;width:100%;flex:none;min-width:0;min-height:40px;max-height:min(44dvh,360px);padding:8px 6px;line-height:1.5;overflow-y:auto;overscroll-behavior:contain}",
      "#composer .composer-actions-row{display:flex;align-items:center;gap:6px;min-height:36px}",
      "#composerTools{margin-right:auto}",
      "#composerVoiceBtn.is-listening{background:#080808;border-color:rgba(255,255,255,.16);color:#f2f2f2;box-shadow:none}",
      "#composerVoiceBtn.is-listening svg{animation:none}",
      "#composerVoiceBtn.has-voice-activity svg{stroke:#4ade80;filter:drop-shadow(0 0 2px rgba(74,222,128,.35));transform-origin:50% 50%;animation:voice-mic-bob .24s ease-in-out infinite alternate}",
      "#composerVoiceBtn.has-voice-activity{background:#080808;border-color:rgba(255,255,255,.16);box-shadow:none}",
      "@media(max-width:480px){#composer{left:10px;right:10px;padding:8px 9px}#composer>.input{padding-left:4px;padding-right:4px}}"
    ].join("\\n");
    document.head.appendChild(layoutStyle);
  }

  if (document.getElementById("composerExpandBtn")) return;

  const style = document.createElement("style");
  style.id = "chat-composer-expand-styles";
  style.textContent = [
    "#composer .row{gap:6px;align-items:flex-end}",
    "#composer .input{min-height:40px!important;padding-top:8px!important;padding-bottom:8px!important;max-height:min(44dvh,360px)!important}",
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
      const previousValue = String(activeInput.value || "");
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

      // If a listener schedules a DOM refresh, restore only while the draft is still unchanged.
      // Never overwrite text the user has typed after applying the expanded draft.
      requestAnimationFrame(() => {
        let current = currentInput();
        if (current.value === value || current.value === previousValue || !current.value) {
          current.value = value;
          current.dispatchEvent(new Event("input", { bubbles: true }));
          current = currentInput();
          if (current.value === previousValue || !current.value) current.value = value;
        }
        syncVisibility();
      });
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
