(function () {
  "use strict";
  const WORKER = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev";
  const MAX_UPLOAD_BYTES = 39 * 1024 * 1024;
  const ALLOWED_EXTENSIONS = /\.(mp4|mov|webm|mkv)$/i;
  let selectedFile = null;
  let accessToken = "";
  let activeJobId = "";
  let polling = false;

  const composerToolsMenu = document.getElementById("composerToolsMenu");
  const composer = document.getElementById("composer");
  let button = document.getElementById("videoCuttingBtn");
  if (!button && composerToolsMenu) {
    button = document.createElement("button");
    button.id = "videoCuttingBtn";
    button.type = "button";
    button.className = "composer-action video-cutting-tool";
    button.setAttribute("aria-label", "ভিডিও কাটিং ও এক্সপোর্ট");
    button.title = "ভিডিও কাটিং ও এক্সপোর্ট";
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/><path d="M6 8h2M11 8h2M6 16h2M11 16h2"/></svg>';
    composerToolsMenu.appendChild(button);
  }
  if (!button || !composer) return;

  const panel = document.createElement("section");
  panel.id = "videoCutPanel";
  panel.className = "video-cut-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "ভিডিও কাটিং");
  panel.innerHTML = [
    '<div class="video-cut-head"><strong>ভিডিও কাটিং ও এক্সপোর্ট</strong><button id="videoCutClose" class="video-cut-close" type="button" aria-label="বন্ধ করুন">×</button></div>',
    '<p class="video-cut-note">শুধু নিজের বা প্রসেস করার অনুমতি আছে এমন ভিডিও দিন। প্রাথমিক সংযোগ পরীক্ষায় সর্বোচ্চ ৩৯ MiB ফাইল সমর্থিত; বড় ভিডিওর direct-upload ব্যবস্থা এখনো তৈরি হয়নি।</p>',
    '<label class="video-cut-field">ভিডিও ফাইল (MP4, MOV, WebM, MKV)<input id="videoCutFile" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv"></label>',
    '<label class="video-cut-field">ভিডিও কাটিং অ্যাক্সেস টোকেন<input id="videoCutToken" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="নিরাপদ টোকেন লিখুন"></label>',
    '<p class="video-cut-note">টোকেন এই পেজের মেমরিতেই থাকবে; localStorage বা চ্যাট ইতিহাসে সংরক্ষণ করা হবে না।</p>',
    '<div class="video-cut-actions"><button id="videoCutUpload" class="primary" type="button">আপলোড ও কাটুন</button><button id="videoCutForget" type="button">টোকেন মুছুন</button></div>',
    '<div id="videoCutStatus" class="video-cut-status" role="status" aria-live="polite">সংযোগ পরীক্ষা করতে আপলোড শুরু করুন।</div>',
    '<div class="video-cut-progress" aria-hidden="true"><span id="videoCutProgress"></span></div>',
    '<a id="videoCutDownload" class="video-cut-download" href="#" hidden>ভিডিও ডাউনলোড</a>'
  ].join("");
  composer.parentNode.insertBefore(panel, composer);

  const fileInput = panel.querySelector("#videoCutFile");
  const tokenInput = panel.querySelector("#videoCutToken");
  const uploadButton = panel.querySelector("#videoCutUpload");
  const forgetButton = panel.querySelector("#videoCutForget");
  const closeButton = panel.querySelector("#videoCutClose");
  const statusNode = panel.querySelector("#videoCutStatus");
  const progressNode = panel.querySelector("#videoCutProgress");
  const downloadLink = panel.querySelector("#videoCutDownload");

  function setStatus(message, state) {
    statusNode.textContent = String(message || "");
    statusNode.dataset.state = state || "info";
  }

  function setProgress(value) {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    progressNode.style.width = percent + "%";
    progressNode.parentElement.setAttribute("aria-label", "অগ্রগতি " + Math.round(percent) + "%");
  }

  function errorMessage(code, fallback) {
    const messages = {
      video_cutting_not_configured: "ভিডিও কাটিং সার্ভার এখনো কনফিগার করা হয়নি। সার্ভার endpoint ও secret নিরাপদভাবে সেট করতে হবে।",
      video_cutting_access_denied: "অ্যাক্সেস টোকেন সঠিক নয় বা অনুমোদিত নয়।",
      video_upload_too_large: "ফাইলটি প্রাথমিক পরীক্ষার ৩৯ MiB সীমার চেয়ে বড়।",
      video_content_type_required: "ভিডিওর MIME ধরন সঠিক নয়।",\n      invalid_video_filename: "ভিডিও ফাইলের নাম সঠিক নয়.",
      video_cutting_upstream_timeout: "ভিডিও সার্ভারে সাড়া পেতে সময় শেষ হয়েছে। Job তৈরি হয়েছে কি না status আবার পরীক্ষা করুন।",
      video_cutting_upstream_unavailable: "ভিডিও প্রসেসিং সার্ভারে সংযোগ করা যায়নি।",
      invalid_job_id: "সার্ভার থেকে পাওয়া job ID সঠিক নয়।"
    };
    return messages[code] || fallback || "ভিডিও প্রসেসিং অনুরোধ ব্যর্থ হয়েছে।";
  }

  async function requestJson(path, options) {
    const response = await fetch(WORKER + path, Object.assign({ cache: "no-store" }, options || {}));
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      const error = new Error(errorMessage(data.error, data.detail || ("HTTP " + response.status)));
      error.code = data.error || "";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function validateFile(file) {
    if (!file) throw new Error("আগে একটি ভিডিও ফাইল নির্বাচন করুন।");
    if (file.size <= 0) throw new Error("খালি ভিডিও ফাইল আপলোড করা যাবে না।");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("প্রাথমিক পরীক্ষার সর্বোচ্চ ফাইল সাইজ ৩৯ MiB।");
    if (!(String(file.type || "").startsWith("video/") || ALLOWED_EXTENSIONS.test(file.name || ""))) {
      throw new Error("সমর্থিত ভিডিও ফাইল নির্বাচন করুন: MP4, MOV, WebM বা MKV।");
    }
  }

  function openPanel() {
    panel.hidden = false;
    const menu = document.getElementById("composerToolsMenu");
    const plus = document.getElementById("plusBtn");
    if (menu) menu.classList.remove("open");
    if (plus) plus.setAttribute("aria-expanded", "false");
    fileInput.click();
  }

  async function pollJob(jobId, deadline) {
    if (!polling) return;
    if (Date.now() >= deadline) {
      polling = false;
      setStatus("এই পেজে status polling-এর ১৫ মিনিটের সীমা শেষ হয়েছে। Job ID: " + jobId + "। পরে আবার status পরীক্ষা করুন।", "error");
      uploadButton.disabled = false;
      return;
    }
    try {
      const job = await requestJson("/video-cut/jobs/" + encodeURIComponent(jobId), {
        headers: { Authorization: "Bearer " + accessToken }
      });
      const state = String(job.status || "").toLowerCase();
      const percent = Number(job.progress_percent || job.progress || 0);
      setProgress(percent);
      setStatus("Job " + jobId + " · অবস্থা: " + (state || "unknown") + " · অগ্রগতি: " + Math.round(percent) + "%", "info");
      if (state === "completed") {
        polling = false;
        uploadButton.disabled = false;
        setProgress(100);
        setStatus("ভিডিও তৈরি হয়েছে। ডাউনলোড বোতাম চাপুন।", "success");
        downloadLink.hidden = false;
        downloadLink.dataset.jobId = jobId;
        return;
      }
      if (state === "failed" || state === "cancelled") {
        polling = false;
        uploadButton.disabled = false;
        setStatus(state === "failed" ? "ভিডিও প্রসেসিং ব্যর্থ হয়েছে। সার্ভারের job details পরীক্ষা করুন।" : "ভিডিও প্রসেসিং বাতিল হয়েছে।", "error");
        return;
      }
      window.setTimeout(function () { pollJob(jobId, deadline); }, 3000);
    } catch (error) {
      polling = false;
      uploadButton.disabled = false;
      setStatus(error.message || "Job status পড়া যায়নি। Job ID: " + jobId, "error");
    }
  }

  async function startUpload() {
    if (uploadButton.disabled) return;
    try {
      validateFile(selectedFile);
      const token = String(tokenInput.value || accessToken || "").trim();
      if (!token) {
        setStatus("প্রথমে ভিডিও কাটিং অ্যাক্সেস টোকেন লিখুন।", "error");
        tokenInput.focus();
        return;
      }
      accessToken = token;
      tokenInput.value = "";
      uploadButton.disabled = true;
      downloadLink.hidden = true;
      downloadLink.dataset.ready = "false";
      downloadLink.href = "#";
      setProgress(0);
      setStatus("ভিডিও কাটিং সার্ভারের কনফিগারেশন যাচাই হচ্ছে…", "info");
      const healthResponse = await fetch(WORKER + "/video-cut/health", { cache: "no-store" });
      const health = await healthResponse.json().catch(function () { return {}; });
      if (!healthResponse.ok || !health.enabled) {
        throw new Error(errorMessage("video_cutting_not_configured"));
      }
      setStatus("নিরাপদ সংযোগে ভিডিও আপলোড হচ্ছে…", "info");
      const upload = await requestJson("/video-cut/upload", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": selectedFile.type || "video/mp4",
          "X-Filename": selectedFile.name || "authorized-video.mp4"
        },
        body: selectedFile
      });
      activeJobId = String((upload.job && upload.job.id) || upload.job_id || upload.id || "");
      if (!activeJobId) throw new Error("সার্ভার আপলোড গ্রহণ করেছে, কিন্তু job ID দেয়নি।");
      setProgress(1);
      setStatus("আপলোড গৃহীত হয়েছে। Job ID: " + activeJobId + "। প্রসেসিংয়ের অগ্রগতি দেখা হচ্ছে…", "info");
      polling = true;
      pollJob(activeJobId, Date.now() + 15 * 60 * 1000);
    } catch (error) {
      uploadButton.disabled = false;
      setStatus(error.message || "ভিডিও আপলোড করা যায়নি।", "error");
    }
  }

  async function downloadOutput() {
    if (!window.MosharrofVideoCuttingDownload) {
      setStatus("ডাউনলোড মডিউল লোড হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।", "error");
      return;
    }
    await window.MosharrofVideoCuttingDownload({
      worker: WORKER,
      jobId: downloadLink.dataset.jobId,
      accessToken: accessToken,
      link: downloadLink,
      onStatus: setStatus
    });
  }

  button.addEventListener("click", openPanel);
  fileInput.addEventListener("change", function () {
    selectedFile = fileInput.files && fileInput.files[0] || null;
    if (!selectedFile) return;
    try {
      validateFile(selectedFile);
      setStatus("নির্বাচিত: " + selectedFile.name + " · " + (selectedFile.size / (1024 * 1024)).toFixed(2) + " MiB", "info");
    } catch (error) {
      selectedFile = null;
      fileInput.value = "";
      setStatus(error.message, "error");
    }
  });
  uploadButton.addEventListener("click", startUpload);
  downloadLink.addEventListener("click", function (event) {
    if (downloadLink.dataset.ready !== "true") {
      event.preventDefault();
      downloadOutput();
    }
  });
  forgetButton.addEventListener("click", function () {
    accessToken = "";
    tokenInput.value = "";
    setStatus("অ্যাক্সেস টোকেন মুছে ফেলা হয়েছে।", "info");
  });
  closeButton.addEventListener("click", function () { panel.hidden = true; });
  window.addEventListener("pagehide", function () {
    polling = false;
  });
})();
