/* Composer expansion module: independent of the main page's local variables. */
(function(){
  "use strict";
  function init(){
    var input=document.querySelector("#input");
    var expandBtn=document.querySelector("#composerExpandBtn");
    var editor=document.querySelector("#mosharrofExpandEditor");
    var draft=editor&&editor.querySelector("textarea");
    if(!input||!expandBtn||!editor||!draft)return;
    function updateExpandVisibility(){
      var lines=input.value.split("\n").length;
      expandBtn.classList.toggle("is-visible",lines>8);
    }
    function closeEditor(){editor.setAttribute("aria-hidden","true");}
    input.addEventListener("input",updateExpandVisibility);
    expandBtn.addEventListener("click",function(){
      draft.value=input.value;
      editor.setAttribute("aria-hidden","false");
      draft.focus();
    });
    editor.querySelector("[data-expand-cancel]").addEventListener("click",closeEditor);
    editor.querySelector("[data-expand-apply]").addEventListener("click",function(){
      input.value=draft.value;
      input.dispatchEvent(new Event("input",{bubbles:true}));
      closeEditor();
      input.focus();
    });
    editor.addEventListener("click",function(event){if(event.target===editor)closeEditor();});
    document.addEventListener("keydown",function(event){
      if(event.key==="Escape"&&editor.getAttribute("aria-hidden")==="false")closeEditor();
    });
    updateExpandVisibility();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
