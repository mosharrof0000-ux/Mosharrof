(function () {
  "use strict";
  var WORKER = "https://mosharrof-video-generation.mosharrof0000.workers.dev";
  var state = { enabled: false, checked: false, status: "ভিডিও তৈরির অবস্থা যাচাই হচ্ছে…" };

  function init() {
    var composer = document.getElementById("composer");
    var send = document.getElementById("sendBtn");
    if (!composer || !send || document.getElementById("videoGenerationBtn")) return;
    var style = document.createElement("style");
    style.textContent = [
      ".mos-video-modal{position:fixed;inset:0;z-index:21000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.82)}",
      ".mos-video-modal.open{display:flex}",
      ".mos-video-panel{width:min(100%,560px);max-height:90vh;overflow:auto;background:#090909;border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:16px;color:#f5f5f5;box-shadow:0 18px 55px rgba(0,0,0,.6)}",
      ".mos-video-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}",
      ".mos-video-title{font-size:15px;font-weight:750;flex:1}",
      ".mos-video-close,.mos-video-submit{border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:9px 12px;background:#171717;color:#f5f5f5}",
      ".mos-video-submit{background:#f5f5f5;color:#111;font-weight:750}",
      ".mos-video-prompt{width:100%;min-height:120px;resize:vertical;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:12px;background:#111;color:#f5f5f5;font:inherit;line-height:1.5}",
      ".mos-video-row{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap}",
      ".mos-video-status{font-size:12px;line-height:1.6;color:#b8b8bd;margin-top:10px;white-space:pre-wrap}",
      ".mos-video-status.error{color:#fca5a5}.mos-video-status.success{color:#86efac}",
      ".generated-video{max-width:min(94%,820px);width:min(94%,820px)}.generated-video video{display:block;width:100%;max-width:820px;max-height:70vh;border-radius:16px;background:#050505}",
      ".generated-video .video-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.generated-video .video-actions a{display:inline-flex;padding:8px 11px;border-radius:10px;background:#202020;color:#fff;text-decoration:none;font-size:12px}",
      ".mos-video-note{font-size:11px;color:#8d8d94;margin-top:9px;line-height:1.5}"
    ].join("\n");
    document.head.appendChild(style);
    var button = document.createElement("button");
    button.type = "button"; button.className = "composer-action"; button.id = "videoGenerationBtn";
    button.setAttribute("aria-label", "১০ সেকেন্ডের ভিডিও তৈরি"); button.title = "১০ সেকেন্ডের AI ভিডিও"; button.textContent = "▣";
    var toolsMenu = document.getElementById("composerToolsMenu");
    if (toolsMenu) toolsMenu.appendChild(button);
    else send.parentNode.insertBefore(button, send);
    var modal = document.createElement("section");
    modal.className = "mos-video-modal"; modal.id = "mosVideoModal";
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = '<div class="mos-video-panel"><div class="mos-video-head"><div class="mos-video-title">১০ সেকেন্ডের AI ভিডিও</div><button type="button" class="mos-video-close" data-video-close>বন্ধ</button></div><textarea class="mos-video-prompt" data-video-prompt maxlength="5000" aria-label="ভিডিওর বর্ণনা" placeholder="কী ধরনের ভিডিও চান, বাংলায় বা ইংরেজিতে লিখুন…"></textarea><div class="mos-video-row"><label for="mosVideoAspect">অনুপাত <select id="mosVideoAspect" data-video-aspect><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option><option>3:4</option></select></label><button type="button" class="mos-video-submit" data-video-submit disabled>ভিডিও তৈরি করুন</button></div><div class="mos-video-status" data-video-status>ভিডিও তৈরির অবস্থা যাচাই হচ্ছে…</div><div class="mos-video-note">ভিডিও তৈরির খরচ হতে পারে। FAL_KEY, মালিকের স্পষ্ট অনুমতি ও durable rate limit না থাকলে সুবিধাটি বন্ধ থাকবে।</div></div>';
    document.body.appendChild(modal);
    var prompt = modal.querySelector("[data-video-prompt]");
    var submit = modal.querySelector("[data-video-submit]");
    var status = modal.querySelector("[data-video-status]");
    var aspect = modal.querySelector("[data-video-aspect]");
    function setStatus(message, kind) { status.textContent = message; status.className = "mos-video-status" + (kind ? " " + kind : ""); }
    function openModal() { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); setStatus(state.status, state.enabled ? "success" : "error"); prompt.focus(); }
    function closeModal() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
    async function refreshHealth() {
      try {
        var response = await fetch(WORKER + "/health", { method: "GET", cache: "no-store" });
        var data = await response.json();
        state.checked = true;
        state.enabled = data.ok === true && data.enabled === true && data.provider_configured === true;
        state.status = state.enabled ? "ভিডিও সার্ভার প্রস্তুত। ১০ সেকেন্ডের ভিডিওর বর্ণনা লিখুন।"
          : (!data.enabled ? "ভিডিও তৈরি নিরাপত্তার কারণে বন্ধ আছে। FAL_KEY, durable rate limit এবং VIDEO_GENERATION_ENABLED=true স্পষ্টভাবে কনফিগার করতে হবে।"
          : "FAL_KEY কনফিগার করা নেই; ভিডিও তৈরি করা যাবে না।");
      } catch { state.checked = false; state.enabled = false; state.status = "ভিডিও সার্ভার পৌঁছানো যাচ্ছে না; কোনো অনুরোধ পাঠানো হয়নি।"; }
      submit.disabled = !state.enabled || !prompt.value.trim();
      setStatus(state.status, state.enabled ? "success" : "error");
    }
    async function pollStatus(requestId) {
      for (var attempt = 0; attempt < 60; attempt++) {
        await new Promise(function (resolve) { window.setTimeout(resolve, 5000); });
        setStatus("ভিডিও তৈরি হচ্ছে… " + ((attempt + 1) * 5) + " সেকেন্ড", "");
        var response = await fetch(WORKER + "/video-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: requestId }) });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok || data.ok !== true) throw new Error(data.message || data.error || "ভিডিওর অবস্থা পাওয়া যায়নি");
        if (data.status === "COMPLETED") return data;
        if (data.status === "FAILED" || data.status === "CANCELLED") throw new Error("ভিডিও তৈরি ব্যর্থ হয়েছে");
      }
      throw new Error("ভিডিও তৈরি করতে বেশি সময় লাগছে; পরে status আবার পরীক্ষা করুন");
    }
    function renderVideo(data, promptText) {
      var messages = document.getElementById("messages");
      if (!messages) throw new Error("চ্যাটের ফলাফল এলাকা পাওয়া যায়নি");
      var card = document.createElement("div"); card.className = "message generated-video";
      var title = document.createElement("div"); title.textContent = "তৈরি ভিডিও · " + String(data.duration || 10) + "s"; card.appendChild(title);
      var video = document.createElement("video"); video.controls = true; video.playsInline = true; video.preload = "metadata"; video.src = data.video_url; card.appendChild(video);
      var actions = document.createElement("div"); actions.className = "video-actions";
      var link = document.createElement("a"); link.href = data.video_url; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.download = data.file_name || "mosharrof-video.mp4"; link.textContent = "ভিডিও খুলুন / সংরক্ষণ করুন"; actions.appendChild(link); card.appendChild(actions);
      var caption = document.createElement("div"); caption.className = "video-actions"; caption.textContent = "বর্ণনা: " + promptText.slice(0, 500); card.appendChild(caption);
      messages.appendChild(card);
      var scroll = document.getElementById("chatScroll"); if (scroll) scroll.scrollTop = scroll.scrollHeight;
    }
    button.addEventListener("click", function () {
      var menu = document.getElementById("composerToolsMenu");
      var plus = document.getElementById("plusBtn");
      if (menu) menu.classList.remove("open");
      if (plus) plus.setAttribute("aria-expanded", "false");
      openModal();
    });
    modal.querySelector("[data-video-close]").addEventListener("click", closeModal);
    modal.addEventListener("click", function (event) { if (event.target === modal) closeModal(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeModal(); });
    prompt.addEventListener("input", function () { submit.disabled = !state.enabled || !prompt.value.trim(); });
    submit.addEventListener("click", async function () {
      var text = String(prompt.value || "").trim();
      if (!state.enabled || !text || submit.disabled) return;
      submit.disabled = true; setStatus("ভিডিও অনুরোধ পাঠানো হচ্ছে…", "");
      try {
        var response = await fetch(WORKER + "/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text, aspect_ratio: aspect.value }) });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok || data.ok !== true) throw new Error(data.message || data.error || "ভিডিও অনুরোধ ব্যর্থ");
        setStatus("ভিডিও কিউতে আছে; ফলাফলের জন্য অপেক্ষা করুন…", "");
        var result = await pollStatus(data.request_id);
        renderVideo(result, text); setStatus("ভিডিও তৈরি হয়েছে।", "success"); prompt.value = "";
      } catch (error) { setStatus("ভিডিও তৈরি হয়নি: " + String(error && error.message || error), "error"); }
      finally { submit.disabled = !state.enabled || !prompt.value.trim(); }
    });
    refreshHealth();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
