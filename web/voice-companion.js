/* MOSHARROF always-near voice companion: website dock plus native launch handoff. */
(function () {
  "use strict";
  function init() {
    if (document.getElementById("mosharrofVoiceDock")) return;
    var style = document.createElement("style");
    style.textContent = [
      "#mosharrofVoiceDock{position:fixed;right:0;top:48%;z-index:9998;display:flex;align-items:center;gap:8px;transform:translateX(calc(100% - 9px));transition:transform .22s ease;max-width:calc(100vw - 12px);font-family:system-ui,sans-serif}",
      "#mosharrofVoiceDock.open{transform:translateX(0)}",
      "#mosharrofVoiceDock .mvd-tab{width:9px;height:54px;border-radius:12px 0 0 12px;border:1px solid rgba(255,255,255,.3);border-right:0;background:linear-gradient(180deg,#00e5ff,#7655ff);box-shadow:0 0 12px rgba(0,217,255,.45);padding:0;flex:none}",
      "#mosharrofVoiceDock .mvd-panel{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid rgba(255,255,255,.16);border-radius:18px 0 0 18px;background:rgba(12,12,16,.97);box-shadow:0 0 18px rgba(0,0,0,.55)}",
      "#mosharrofVoiceDock .mvd-action{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;background:#171923;border:1px solid rgba(255,255,255,.18);font-size:18px}",
      "#mosharrofVoiceDock .mvd-talk{background:linear-gradient(135deg,#00bcd4,#6652e8);box-shadow:0 0 14px rgba(0,217,255,.32)}",
      "#mosharrofVoiceDock .mvd-hide{font-size:12px;width:auto;padding:0 10px;border-radius:13px;color:#d4d4d8}",
      "#mosharrofVoiceDock .mvd-label{font-size:11px;color:#eee;white-space:nowrap;max-width:90px}",
      "@media(prefers-reduced-motion:reduce){#mosharrofVoiceDock{transition:none}}"
    ].join("");
    document.head.appendChild(style);
    var dock = document.createElement("div");
    dock.id = "mosharrofVoiceDock";
    dock.innerHTML = '<button type="button" class="mvd-tab" aria-label="MOSHARROF AI খুলুন" title="MOSHARROF AI"></button>' +
      '<div class="mvd-panel"><span class="mvd-label">MOSHARROF<br>কথা বলুন</span>' +
      '<button type="button" class="mvd-action mvd-talk" aria-label="ভয়েস ইনপুট চালু করুন" title="কথা বলুন">🎙</button>' +
      '<button type="button" class="mvd-action mvd-hide" aria-label="পাশে লুকিয়ে রাখুন" title="লুকান">লুকান</button></div>';
    document.body.appendChild(dock);
    var tab = dock.querySelector(".mvd-tab");
    var talk = dock.querySelector(".mvd-talk");
    var hide = dock.querySelector(".mvd-hide");
    function setOpen(open) {
      dock.classList.toggle("open", !!open);
      tab.setAttribute("aria-expanded", open ? "true" : "false");
      tab.setAttribute("aria-label", open ? "MOSHARROF AI বন্ধ করুন" : "MOSHARROF AI খুলুন");
    }
    tab.addEventListener("click", function () { setOpen(!dock.classList.contains("open")); });
    hide.addEventListener("click", function () { setOpen(false); });
    var speakNextReply = false;
    var lastSpokenReply = null;
    function speakReplyIfReady() {
      if (!speakNextReply) return;
      var replies = document.querySelectorAll(".message.ai:not(.typing)");
      if (!replies.length) return;
      var reply = replies[replies.length - 1];
      if (reply === lastSpokenReply) return;
      var speaker = reply.querySelector(".message-speak-shortcut");
      if (!speaker) return;
      lastSpokenReply = reply;
      speakNextReply = false;
      speaker.click();
    }
    var replyObserver = new MutationObserver(speakReplyIfReady);
    replyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    talk.addEventListener("click", function () {
      speakNextReply = true;
      lastSpokenReply = document.querySelector(".message.ai:not(.typing)");
      setOpen(false);
      var voice = document.getElementById("composerVoiceBtn");
      if (voice) {
        voice.scrollIntoView({ block: "nearest", behavior: "smooth" });
        voice.click();
      } else {
        var input = document.getElementById("input");
        if (input) { input.focus(); input.placeholder = "আপনার কথা লিখুন…"; }
      }
    });
    window.addEventListener("mosharrof:open-voice", function () {
      setOpen(true);
      var attempts = 0;
      function activateVoice() {
        var voice = document.getElementById("composerVoiceBtn");
        if (voice) {
          voice.scrollIntoView({ block: "nearest", behavior: "smooth" });
          voice.click();
          return;
        }
        if (++attempts < 12) window.setTimeout(activateVoice, 400);
      }
      window.setTimeout(activateVoice, 400);
    });
    /* A native tile or overlay is opt-in; the website dock stays tucked at the edge. */
    window.MOSHARROFVoiceCompanion = {
      show: function () { setOpen(true); },
      hide: function () { setOpen(false); },
      talk: function () { setOpen(true); talk.click(); }
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
