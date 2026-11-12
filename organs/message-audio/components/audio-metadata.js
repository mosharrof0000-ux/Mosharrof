export function createAudioTitle(value, maxLength = 72) {
  const text = String(value == null ? "" : value).replace(/[\t\r\n ]+/g, " ").trim();
  if (!text) return "MOSHARROF Audio";
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  const match = text.match(/^.*?[.!?।！？](?=\s|$)/u);
  const firstSentence = match ? match[0].trim() : text;
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
    .replace(/[\u0000-\u001f\u007f\/\\:*?"<>|]/g, " ")
    .replace(/\s+/gu, "_")
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
  payload[0] = 3;
  payload.set(text, 1);
  const frame = new Uint8Array(10 + payload.length);
  for (let i = 0; i < 4; i += 1) frame[i] = id.charCodeAt(i);
  frame.set(syncSafeSize(payload.length), 4);
  frame.set(payload, 10);
  return frame;
}

export async function addMp3Metadata(blob, title) {
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
