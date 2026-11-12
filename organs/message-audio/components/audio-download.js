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
  const schedule = options.setTimeoutFn || globalThis.setTimeout;
  const now = options.now || (() => new Date());
  if (!documentRef || typeof documentRef.createElement !== "function") throw new Error("document is unavailable");
  if (!URLApi || typeof URLApi.createObjectURL !== "function" || typeof URLApi.revokeObjectURL !== "function") {
    throw new Error("audio download URLs are unavailable");
  }

  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "message-action message-audio-download";
  button.textContent = "⬇ অডিও ডাউনলোড";
  button.title = "এই মেসেজের তৈরি অডিও ফাইল ডাউনলোড করুন";
  button.setAttribute("aria-label", button.title);
  button.dataset.messageAudioDownload = "true";
  button.addEventListener("click", (event) => {
    if (event && typeof event.stopPropagation === "function") event.stopPropagation();
    const url = URLApi.createObjectURL(blob);
    const link = documentRef.createElement("a");
    const stamp = now().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = "mosharrof-message-audio-" + stamp + "." + extensionFor(blob);
    link.style.display = "none";
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    schedule(() => URLApi.revokeObjectURL(url), 1500);
  });
  return button;
}
