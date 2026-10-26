/* Composer expansion module. UI is created here so the legacy entrypoint stays frozen. */
(function(){
  "use strict";
  function init(){
    var input=document.querySelector("#input");
    var voice=document.querySelector("#composerVoiceBtn");
    if(!input||!voice||document.querySelector("#composerExpandBtn"))return;
    var button=document.createElement("button");
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
