(function(){
  "use strict";
  var input=document.getElementById("input");
  if(!input||document.getElementById("composerExpandBtn"))return;
  var style=document.createElement("style");
  style.textContent=".composer-expand-btn{width:34px;height:36px;flex:none;display:inline-grid;place-items:center;border:1px solid rgba(255,255,255,.16);border-radius:9px;background:#080808;color:#f2f2f2;font-size:19px;line-height:1}.composer-expand-btn:hover{background:#111;border-color:rgba(255,255,255,.3)}.composer-expand-btn:focus-visible{outline:2px solid #aaa;outline-offset:2px}.expand-editor-backdrop{position:fixed;inset:0;z-index:10003;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.78);padding-top:calc(16px + var(--safe-t));padding-bottom:calc(16px + var(--safe-b))}.expand-editor-backdrop.open{display:flex}.expand-editor-panel{display:flex;flex-direction:column;gap:12px;width:min(820px,100%);max-height:100%;padding:16px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:#202020;box-shadow:0 12px 40px rgba(0,0,0,.6)}.expand-editor-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:15px;font-weight:700}.expand-editor-close{width:34px;height:34px;border-radius:9px;background:#111;color:#fff;font-size:22px}.expand-editor-textarea{width:100%;min-height:min(52vh,420px);flex:1;resize:vertical;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#101010;color:#fff;padding:12px;font:inherit;font-size:16px;line-height:1.55;outline:none}.expand-editor-textarea:focus{border-color:rgba(255,255,255,.42)}.expand-editor-actions{display:flex;justify-content:flex-end;gap:8px}.expand-editor-actions button{min-height:40px;padding:9px 15px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:#111;color:#fff;font-weight:650}.expand-editor-actions [data-expand-apply]{background:#e5e5e5;color:#111;border-color:#e5e5e5}@media(max-width:390px){.composer{left:6px;right:6px;padding:7px}.row{gap:4px}.composer-expand-btn{width:32px}.composer-tool-toggle,.composer-action,.send{width:32px;height:36px}.input{padding-left:3px;padding-right:3px}}";
  document.head.appendChild(style);
  var button=document.createElement("button");
  button.className="composer-expand-btn";
  button.id="composerExpandBtn";
  button.type="button";
  button.setAttribute("aria-label","লেখার জায়গা বড় করুন");
  button.title="বড় করে লিখুন";
  button.setAttribute("aria-haspopup","dialog");
  button.textContent="⤢";
  input.insertAdjacentElement("afterend",button);
  var backdrop=document.createElement("div");
  backdrop.className="expand-editor-backdrop";
  backdrop.id="mosharrofExpandEditor";
  backdrop.setAttribute("role","dialog");
  backdrop.setAttribute("aria-modal","true");
  backdrop.setAttribute("aria-labelledby","mosharrofExpandTitle");
  backdrop.setAttribute("aria-hidden","true");
  backdrop.innerHTML='<section class="expand-editor-panel"><div class="expand-editor-heading"><span id="mosharrofExpandTitle">বার্তা বড় করে সম্পাদনা করুন</span><button class="expand-editor-close" id="composerExpandClose" type="button" aria-label="বন্ধ করুন">×</button></div><textarea class="expand-editor-textarea" aria-label="সম্পূর্ণ বার্তা" placeholder="এখানে সম্পূর্ণ বার্তা লিখুন..."></textarea><div class="expand-editor-actions"><button id="composerExpandCancel" type="button">বাতিল</button><button data-expand-apply type="button">লেখা প্রয়োগ করুন</button></div></section>';
  document.body.appendChild(backdrop);
  var area=backdrop.querySelector("textarea");
  function close(restore){backdrop.classList.remove("open");backdrop.setAttribute("aria-hidden","true");if(restore)button.focus();}
  function open(){area.value=input.value;backdrop.classList.add("open");backdrop.setAttribute("aria-hidden","false");requestAnimationFrame(function(){area.focus();area.setSelectionRange(area.value.length,area.value.length);});}
  button.addEventListener("click",open);
  backdrop.querySelector("#composerExpandClose").addEventListener("click",function(){close(true);});
  backdrop.querySelector("#composerExpandCancel").addEventListener("click",function(){close(true);});
  backdrop.querySelector("[data-expand-apply]").addEventListener("click",function(){input.value=area.value;input.dispatchEvent(new Event("input",{bubbles:true}));close(true);});
  backdrop.addEventListener("click",function(event){if(event.target===backdrop)close(true);});
  document.addEventListener("keydown",function(event){if(event.key==="Escape"&&backdrop.classList.contains("open"))close(true);});
})();
