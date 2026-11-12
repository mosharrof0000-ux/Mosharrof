function iconMarkup(kind) {
  const paths = {
    speak: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[kind] + '</svg>';
}

function setButtonContent(button, kind, label) {
  if (!button) return;
  button.innerHTML = iconMarkup(kind) + '<span>' + label + '</span>';
}

function extensionFor(blob) {
  const type = String(blob && blob.type || "").toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return "mp3";
}

export function createAudioDownloadButton(blob, options = {}) {
  if (!blob) throw new TypeError("generated audio blob is required");
  const documentRef = options.documentRef || globalThis.document;
  const URLApi = options.URLApi || globalThis.URL;
  const now = options.now || (() => new Date());
  const schedule = options.setTimeoutFn || globalThis.setTimeout;
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
  // Keep the object URL alive long enough for Android WebView/DownloadManager
  // to consume it; immediate revocation can cancel slow mobile downloads.
  schedule(() => URLApi.revokeObjectURL(url), 60000);
  return link;
}
