export function initializeNewChatFloatingOrgan() {
  if (typeof document === "undefined") return;
  var header = document.querySelector("header.top");
  var right = document.getElementById("rightBtn");
  if (!header || !right || document.getElementById("topNewChat")) return;

  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("./style.css", import.meta.url).href;
  document.head.appendChild(css);
  ["compact.css", "theme.css"].forEach(function (name) { var link = document.createElement("link"); link.rel = "stylesheet"; link.href = new URL("./" + name, import.meta.url).href; document.head.appendChild(link); });

  var button = document.createElement("button");
  button.className = "top-new-chat";
  button.id = "topNewChat";
  button.type = "button";
  button.setAttribute("aria-label", "নতুন চ্যাট; চেপে ধরলে ভাসমান চ্যাট");
  button.title = "নতুন চ্যাট · চেপে ধরুন ভাসমান উইন্ডোর জন্য";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  header.insertBefore(button, right);

  import("./theme.js").then(function (theme) { theme.initializeThemeToggle(header, button); }).catch(function (error) { console.error("[MOSHARROF Theme] Initialization failed", error); });

  var pressTimer = null;
  var longPressed = false;
  function enterFloating() { document.body.classList.add("chat-floating"); }
  async function openFloating() {
    var plugins = window.Capacitor && window.Capacitor.Plugins;
    var nativeFloating = plugins && plugins.FloatingChat;
    if (nativeFloating && typeof nativeFloating.enterPictureInPicture === "function") {
      try { await nativeFloating.enterPictureInPicture(); return; } catch (error) { console.warn("[MOSHARROF Floating Chat] Native PiP unavailable; using in-page window.", error); }
    }
    enterFloating();
  }
  function leaveFloating() {
    document.body.classList.remove("chat-floating");
    var app = document.querySelector(".app");
    if (app) { app.style.left = ""; app.style.top = ""; app.style.width = ""; app.style.height = ""; }
  }
  button.addEventListener("pointerdown", function () {
    longPressed = false;
    pressTimer = setTimeout(function () { longPressed = true; openFloating(); }, 550);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (type) {
    button.addEventListener(type, function () { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; });
  });
  button.addEventListener("click", function (event) {
    event.preventDefault(); event.stopPropagation();
    if (longPressed) { longPressed = false; return; }
    if (document.body.classList.contains("chat-floating")) { leaveFloating(); return; }
    var newChat = document.getElementById("newChat");
    if (newChat) newChat.click();
    else { var historyNew = document.getElementById("historyNewChat"); if (historyNew) historyNew.click(); }
  });
  button.addEventListener("dblclick", function (event) { event.preventDefault(); leaveFloating(); });

  var pointers = new Map();
  var drag = null;
  var pinch = null;
  header.addEventListener("pointerdown", function (event) {
    if (!document.body.classList.contains("chat-floating") || event.target.closest("button")) return;
    var app = document.querySelector(".app");
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) drag = { x: event.clientX, y: event.clientY, left: app.offsetLeft, top: app.offsetTop };
    if (pointers.size === 2) {
      var points = Array.from(pointers.values());
      pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), width: app.offsetWidth, height: app.offsetHeight };
      drag = null;
    }
    try { header.setPointerCapture(event.pointerId); } catch (_) {}
  });
  header.addEventListener("pointermove", function (event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    var app = document.querySelector(".app");
    if (pointers.size === 2 && pinch) {
      var points = Array.from(pointers.values());
      var distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      var scale = distance / Math.max(1, pinch.distance);
      app.style.width = Math.max(220, Math.min(innerWidth * .96, pinch.width * scale)) + "px";
      app.style.height = Math.max(220, Math.min(innerHeight * .88, pinch.height * scale)) + "px";
    } else if (drag) {
      app.style.left = Math.max(0, Math.min(innerWidth - app.offsetWidth, drag.left + event.clientX - drag.x)) + "px";
      app.style.top = Math.max(0, Math.min(innerHeight - app.offsetHeight, drag.top + event.clientY - drag.y)) + "px";
    }
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) drag = null;
  }
  header.addEventListener("pointerup", endPointer);
  header.addEventListener("pointercancel", endPointer);
}
initializeNewChatFloatingOrgan();
