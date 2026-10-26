(function () {
  "use strict";
  const MAX_DOWNLOAD_BYTES = 150 * 1024 * 1024;
  let objectUrl = "";

  async function download(options) {
    const jobId = options.jobId;
    const accessToken = options.accessToken;
    const link = options.link;
    const setStatus = options.onStatus;
    if (!jobId || !accessToken) {
      setStatus("ডাউনলোডের জন্য সক্রিয় অ্যাক্সেস টোকেন প্রয়োজন।", "error");
      return;
    }
    link.setAttribute("aria-busy", "true");
    setStatus("ভিডিও ডাউনলোড প্রস্তুত হচ্ছে…", "info");
    try {
      const response = await fetch(options.worker + "/video-cut/jobs/" + encodeURIComponent(jobId) + "/output", {
        headers: { Authorization: "Bearer " + accessToken },
        cache: "no-store"
      });
      if (!response.ok) {
        const data = await response.json().catch(function () { return {}; });
        throw new Error(data.detail || data.error || ("HTTP " + response.status));
      }
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_DOWNLOAD_BYTES) {
        throw new Error("আউটপুট ১৫০ MiB-এর বেশি। এই প্রাথমিক সংস্করণে বড় ফাইলের streaming download এখনো সমর্থিত নয়।");
      }
      const reader = response.body && response.body.getReader ? response.body.getReader() : null;
      if (!reader) throw new Error("এই ব্রাউজারে নিরাপদ streaming reader পাওয়া যায়নি।");
      const chunks = [];
      let total = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > MAX_DOWNLOAD_BYTES) {
          await reader.cancel();
          throw new Error("আউটপুট ১৫০ MiB-এর বেশি। বড় ফাইলের streaming download ব্যবস্থা পরে যোগ করতে হবে।");
        }
        chunks.push(part.value);
      }
      const blob = new Blob(chunks, { type: "video/mp4" });
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = "mosharrof-edited.mp4";
      link.dataset.ready = "true";
      link.textContent = "ভিডিও ডাউনলোড করুন";
      setStatus("ডাউনলোড প্রস্তুত।", "success");
    } catch (error) {
      setStatus(error.message || "ভিডিও ডাউনলোড ব্যর্থ হয়েছে।", "error");
    } finally {
      link.removeAttribute("aria-busy");
    }
  }

  window.MosharrofVideoCuttingDownload = download;
  window.addEventListener("pagehide", function () {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
})();
