function iconMarkup(kind) {
  const paths = {
    speak: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[kind] + '</svg>';
}

function extensionFor(blob) {
  const type = String(blob && blob.type || "").toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return "mp3";
}

function toBase64(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    }
    const encode = globalThis.btoa;
    if (typeof encode !== "function") throw new Error("base64_encoder_unavailable");
    return encode(binary);
  });
}

export function createAudioDownloadButton(blob, options = {}) {
  if (!blob) throw new TypeError("generated audio blob is required");
  const documentRef = options.documentRef || globalThis.document;
  const URLApi = options.URLApi || globalThis.URL;
  const now = options.now || (() => new Date());
  const schedule = options.setTimeoutFn || globalThis.setTimeout;
  const nativePlugin = options.nativePlugin || (() => {
    const capacitor = globalThis.Capacitor;
    if (capacitor?.Plugins?.MessageAudioDownload) return capacitor.Plugins.MessageAudioDownload;
    if (typeof capacitor?.registerPlugin === "function") return capacitor.registerPlugin("MessageAudioDownload");
    return null;
  })();
  if (!documentRef || typeof documentRef.createElement !== "function") throw new Error("document is unavailable");
  if (!URLApi || typeof URLApi.createObjectURL !== "function" || typeof URLApi.revokeObjectURL !== "function") {
    throw new Error("audio download URLs are unavailable");
  }

  const link = documentRef.createElement("a");
  const stamp = now().toISOString().replace(/[:.]/g, "-");
  const filename = "mosharrof-message-audio-" + stamp + "." + extensionFor(blob);
  const url = URLApi.createObjectURL(blob);
  link.className = "message-action message-audio-download";
  link.style.textDecoration = "none";
  link.style.color = "inherit";
  link.href = url;
  link.download = filename;
  link.innerHTML = iconMarkup("download") + "<span>অডিও ডাউনলোড</span>";
  link.title = "এই মেসেজের তৈরি অডিও ফাইল ডাউনলোড করুন";
  link.setAttribute("aria-label", link.title);
  link.dataset.messageAudioDownload = "true";
  link.dataset.filename = filename;
  link.addEventListener("click", async (event) => {
    if (!nativePlugin || typeof nativePlugin.save !== "function") return;
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (link.dataset.downloading === "true") return;
    link.dataset.downloading = "true";
    link.setAttribute("aria-busy", "true");
    link.title = "অডিও Downloads ফোল্ডারে সংরক্ষণ হচ্ছে";
    try {
      const base64 = await toBase64(blob);
      const result = await nativePlugin.save({
        base64,
        filename,
        mimeType: blob.type || "audio/mpeg"
      });
      if (!result || result.saved !== true) throw new Error("native_download_not_confirmed");
      link.innerHTML = iconMarkup("download") + "<span>ডাউনলোড সম্পন্ন</span>";
      link.title = "Downloads/MOSHARROF ফোল্ডারে অডিও সংরক্ষিত হয়েছে";
      link.dataset.downloadComplete = "true";
    } catch (error) {
      link.innerHTML = iconMarkup("download") + "<span>আবার চেষ্টা করুন</span>";
      link.title = "ডাউনলোড ব্যর্থ: " + String(error && error.message || error);
      link.dataset.downloadError = "true";
    } finally {
      link.dataset.downloading = "false";
      link.removeAttribute("aria-busy");
    }
  });
  // Browser downloads need a live object URL. Android Capacitor uses the native
  // MediaStore bridge above and does not depend on WebView's missing download listener.
  schedule(() => URLApi.revokeObjectURL(url), 60000);
  return link;
}
