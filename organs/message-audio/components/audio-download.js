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

export function createAudioTitle(value, maxLength = 72) {
  const text = String(value == null ? "" : value).replace(/[\t\r\n ]+/g, " ").trim();
  if (!text) return "MOSHARROF Audio";
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  const firstSentence = text.split(/(?<=[.!?।！？])\s+/u)[0].trim();
  if (Array.from(firstSentence).length <= maxLength) return firstSentence;
  const words = text.split(" ");
  let excerpt = "";
  for (const word of words) {
    const next = excerpt ? excerpt + " " + word : word;
    if (Array.from(next).length > maxLength) break;
    excerpt = next;
  }
  return excerpt || chars.slice(0, maxLength).join("").trim();
}

export function sanitizeAudioFilenameTitle(value) {
  let safe = createAudioTitle(value)
    .replace(/[\u0000-\u001f\u007f\\/\\\\:*?"<>|]/g, " ")
    .replace(/[\s]+/gu, "_")
    .replace(/^[._ ]+|[._ ]+$/g, "")
    .slice(0, 120);
  if (!safe || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe)) safe = "MOSHARROF_Audio";
  return safe;
}

function syncSafeSize(size) {
  return Uint8Array.of((size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f);
}

function id3TextFrame(id, value, encoder) {
  const text = encoder.encode(String(value));
  const payload = new Uint8Array(1 + text.length);
  payload[0] = 3; // ID3v2.4 UTF-8 text encoding
  payload.set(text, 1);
  const frame = new Uint8Array(10 + payload.length);
  for (let i = 0; i < 4; i += 1) frame[i] = id.charCodeAt(i);
  frame.set(syncSafeSize(payload.length), 4);
  frame.set(payload, 10);
  return frame;
}

async function addMp3Metadata(blob, title) {
  if (!String(blob.type || "").toLowerCase().includes("mpeg")) return blob;
  if (typeof TextEncoder !== "function" || typeof blob.arrayBuffer !== "function") return blob;
  const encoder = new TextEncoder();
  const frames = [
    id3TextFrame("TIT2", title, encoder),
    id3TextFrame("TPE1", "MOSHARROF", encoder)
  ];
  const tagSize = frames.reduce((total, frame) => total + frame.length, 0);
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 4, 0, 0], 0);
  header.set(syncSafeSize(tagSize), 6);
  const original = new Uint8Array(await blob.arrayBuffer());
  const tagged = new Uint8Array(header.length + tagSize + original.length);
  tagged.set(header, 0);
  let offset = header.length;
  for (const frame of frames) {
    tagged.set(frame, offset);
    offset += frame.length;
  }
  tagged.set(original, offset);
  return new Blob([tagged], { type: blob.type || "audio/mpeg" });
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

let filenameSequence = 0;

export async function createAudioDownloadButton(blob, options = {}) {
  if (!blob) throw new TypeError("generated audio blob is required");
  const documentRef = options.documentRef || globalThis.document;
  const URLApi = options.URLApi || globalThis.URL;
  const now = options.now || (() => new Date());
  const schedule = options.setTimeoutFn || globalThis.setTimeout;
  const title = createAudioTitle(options.title);
  const safeTitle = sanitizeAudioFilenameTitle(title);
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

  const audioBlob = await addMp3Metadata(blob, title);
  const timestamp = now().toISOString();
  const stamp = timestamp.slice(0, 19).replace(/[-:T]/g, "");
  filenameSequence = (filenameSequence % 999) + 1;
  const sequence = String(filenameSequence).padStart(3, "0");
  const filename = safeTitle + "_" + stamp + "_" + sequence + "." + extensionFor(audioBlob);
  const url = URLApi.createObjectURL(audioBlob);
  const link = documentRef.createElement("a");
  link.className = "message-action message-audio-download";
  link.style.textDecoration = "none";
  link.style.color = "inherit";
  link.href = url;
  link.download = filename;
  link.innerHTML = iconMarkup("download") + "<span>অডিও ডাউনলোড</span>";
  link.title = "“" + title + "” শিরোনামে তৈরি অডিও ফাইল ডাউনলোড করুন";
  link.setAttribute("aria-label", link.title);
  link.dataset.messageAudioDownload = "true";
  link.dataset.filename = filename;
  link.dataset.audioTitle = title;
  link.addEventListener("click", async (event) => {
    if (!nativePlugin || typeof nativePlugin.save !== "function") return;
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (link.dataset.downloading === "true") return;
    link.dataset.downloading = "true";
    link.setAttribute("aria-busy", "true");
    link.title = "অডিও Downloads ফোল্ডারে সংরক্ষণ হচ্ছে";
    try {
      const base64 = await toBase64(audioBlob);
      const result = await nativePlugin.save({
        base64,
        filename,
        mimeType: audioBlob.type || "audio/mpeg"
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
  schedule(() => URLApi.revokeObjectURL(url), 60000);
  return link;
}
