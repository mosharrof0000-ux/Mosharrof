(function(){
  "use strict";
  var button=document.getElementById("topNewChat");
  if(!button)return;
  var pressTimer=null,longPressed=false;
  function enterFloating(){document.body.classList.add("chat-floating");}
  function leaveFloating(){document.body.classList.remove("chat-floating");var app=document.querySelector(".app");if(app){app.style.left="";app.style.top="";app.style.width="";app.style.height="";}}
  button.addEventListener("pointerdown",function(){longPressed=false;pressTimer=setTimeout(function(){longPressed=true;enterFloating();},550);});
  ["pointerup","pointercancel","pointerleave"].forEach(function(type){button.addEventListener(type,function(){if(pressTimer)clearTimeout(pressTimer);pressTimer=null;});});
  button.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();if(longPressed){longPressed=false;return;}if(document.body.classList.contains("chat-floating")){leaveFloating();return;}if(typeof window.MosharrofStartNewChat==="function")window.MosharrofStartNewChat();});
  button.addEventListener("dblclick",function(e){e.preventDefault();leaveFloating();});
  var header=document.querySelector("header.top"),pointers=new Map(),drag=null,pinch=null;
  if(!header)return;
  header.addEventListener("pointerdown",function(e){
    if(!document.body.classList.contains("chat-floating")||e.target.closest("button"))return;
    var app=document.querySelector(".app");pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1)drag={x:e.clientX,y:e.clientY,left:app.offsetLeft,top:app.offsetTop};
    if(pointers.size===2){var p=Array.from(pointers.values());pinch={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),width:app.offsetWidth,height:app.offsetHeight};drag=null;}
    try{header.setPointerCapture(e.pointerId);}catch(_){}
  });
  header.addEventListener("pointermove",function(e){
    if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});var app=document.querySelector(".app");
    if(pointers.size===2&&pinch){var p=Array.from(pointers.values()),d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),scale=d/Math.max(1,pinch.distance);app.style.width=Math.max(280,Math.min(innerWidth*.96,pinch.width*scale))+"px";app.style.height=Math.max(260,Math.min(innerHeight*.88,pinch.height*scale))+"px";}
    else if(drag){app.style.left=Math.max(0,Math.min(innerWidth-app.offsetWidth,drag.left+e.clientX-drag.x))+"px";app.style.top=Math.max(0,Math.min(innerHeight-app.offsetHeight,drag.top+e.clientY-drag.y))+"px";}
  });
  function end(e){pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!pointers.size)drag=null;}
  header.addEventListener("pointerup",end);header.addEventListener("pointercancel",end);
})();