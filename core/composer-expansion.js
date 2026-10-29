/* Composer expansion module. UI is created here so the legacy entrypoint stays frozen. */
(function(){
  "use strict";
  function init(){
    var input=document.querySelector("#input");
    var voice=document.querySelector("#composerVoiceBtn");
    if(!input||!voice||document.querySelector("#composerExpandBtn"))return;
    if(!document.getElementById("composerExpansionStyles")){var style=document.createElement("style");style.id="composerExpansionStyles";style.textContent="#composerExpandBtn{display:none;flex:none;width:32px;height:32px;border:1px solid rgba(120,150,255,.45);border-radius:9px;background:#111;color:#cbd5ff;font-size:18px;line-height:1}\n#composerExpandBtn.is-visible{display:grid;place-items:center}\n#mosharrofExpandEditor{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78)}\n#mosharrofExpandEditor[aria-hidden=\"false\"]{display:flex}\n#mosharrofExpandEditor .expand-panel{display:flex;flex-direction:column;gap:12px;width:min(720px,100%);max-height:85dvh;padding:16px;border:1px solid #393943;border-radius:16px;background:#171717}\n#mosharrofExpandEditor .expand-panel textarea{width:100%;min-height:45dvh;resize:vertical;padding:12px;border:1px solid #444;border-radius:10px;background:#080808;color:#f5f5f5;line-height:1.6}\n#mosharrofExpandEditor .expand-actions{display:flex;justify-content:flex-end;gap:8px}\n#mosharrofExpandEditor .expand-actions button{padding:9px 13px;border:1px solid #454550;border-radius:9px;background:#24242a}\n#mosharrofExpandEditor [data-expand-apply]{background:#253a73;border-color:#516fc4}";document.head.appendChild(style);}
    var button=document.createElement("button");
    button.className="composer-action";
    button.id="composerExpandBtn";button.type="button";button.setAttribute("aria-label","সম্পূর্ণ লেখার সম্পাদক খুলুন");button.title="বড় সম্পাদক";button.textContent="↗";
    voice.parentNode.insertBefore(button,voice);
    var editor=document.createElement("div");
    editor.id="mosharrofExpandEditor";editor.setAttribute("role","dialog");editor.setAttribute("aria-modal","true");editor.setAttribute("aria-label","সম্পূর্ণ লেখার সম্পাদক");editor.setAttribute("aria-hidden","true");
    editor.innerHTML='<div class="expand-panel"><strong>সম্পূর্ণ লেখা সম্পাদনা</strong><textarea aria-label="সম্পূর্ণ বার্তা"></textarea><div class="expand-actions"><button type="button" data-expand-cancel>বাতিল</button><button type="button" data-expand-apply>প্রয়োগ</button></div></div>';
    document.body.appendChild(editor);
    var draft=editor.querySelector("textarea");
    function update(){button.classList.toggle("is-visible",input.value.split("\n").length>8);}
    function close(){editor.setAttribute("aria-hidden","true");}
    input.addEventListener("input",update);
    button.addEventListener("click",function(){draft.value=input.value;editor.setAttribute("aria-hidden","false");draft.focus();});
    editor.querySelector("[data-expand-cancel]").addEventListener("click",close);
    editor.querySelector("[data-expand-apply]").addEventListener("click",function(){input.value=draft.value;input.dispatchEvent(new Event("input",{bubbles:true}));close();input.focus();});
    editor.addEventListener("click",function(e){if(e.target===editor)close();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&editor.getAttribute("aria-hidden")==="false")close();});
    update();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
