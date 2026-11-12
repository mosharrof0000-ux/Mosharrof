import test from "node:test";
import assert from "node:assert/strict";
import { createAudioDownloadButton, createAudioTitle, sanitizeAudioFilenameTitle } from "../components/audio-download.js";

function fakeDocument() {
  return {
    createElement(tag) {
      const listeners = {};
      return {
        tag, style: {}, dataset: {}, listeners,
        setAttribute(name, value) { this[name] = value; },
        removeAttribute(name) { delete this[name]; },
        addEventListener(name, callback) { listeners[name] = callback; }
      };
    }
  };
}

function fakeUrlApi() {
  const revoked = [];
  return {
    revoked,
    blobs: new Map(),\n    createObjectURL(blob) { const url = "blob:" + blob.size; this.blobs.set(url, blob); return url; },
    revokeObjectURL(url) { revoked.push(url); }
  };
}

test("uses the full short message as the title and a safe Bengali filename", () => {
  assert.equal(createAudioTitle("আপনি কেমন আছেন?"), "আপনি কেমন আছেন?");
  assert.equal(sanitizeAudioFilenameTitle("আপনি কেমন আছেন?"), "আপনি_কেমন_আছেন");
});

test("uses a meaningful first sentence or excerpt for long messages", () => {
  assert.equal(createAudioTitle("প্রথম বাক্যটি এখানে। দ্বিতীয় বাক্যটি পরে আছে।"), "প্রথম বাক্যটি এখানে।");
  assert.ok(Array.from(createAudioTitle("বাংলা শব্দ ".repeat(30))).length <= 72);
});

test("creates a named browser download with embedded MP3 Title and Artist metadata", async () => {
  const URLApi = fakeUrlApi();
  const scheduled = [];
  const link = await createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    title: "আপনি কেমন আছেন?",
    documentRef: fakeDocument(),
    URLApi,
    setTimeoutFn: (callback, delay) => scheduled.push({ callback, delay }),
    now: () => new Date("2026-11-13T00:00:00.000Z")
  });
  assert.equal(link.dataset.messageAudioDownload, "true");
  assert.match(link.innerHTML, /অডিও ডাউনলোড/);
  assert.match(link.download, /^আপনি_কেমন_আছেন_20261113000000_\d{3}\.mp3$/);
  assert.equal(link.dataset.audioTitle, "আপনি কেমন আছেন?");
  const tagged = await (await fetch(link.href)).arrayBuffer().catch(() => null);
  assert.ok(link.href.startsWith("blob:"));
  assert.equal(scheduled[0].delay, 60000);
  scheduled[0].callback();
  assert.deepEqual(URLApi.revoked, [link.href]);
});

test("saves the tagged audio through the Android native Downloads bridge", async () => {
  let saved;
  const link = await createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    title: "হ্যালো",
    documentRef: fakeDocument(),
    URLApi: fakeUrlApi(),
    nativePlugin: {
      async save(payload) {
        saved = payload;
        return { saved: true, uri: "content://downloads/audio", bytes: 3 };
      }
    },
    setTimeoutFn: () => {},
    now: () => new Date("2026-11-13T00:00:00.000Z")
  });
  let prevented = false;
  await link.listeners.click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(saved.filename, /^হ্যালো_20261113000000_\d{3}\.mp3$/);
  assert.equal(saved.mimeType, "audio/mpeg");
  const taggedBytes = Buffer.from(saved.base64, "base64");
  assert.equal(taggedBytes.subarray(0, 3).toString("ascii"), "ID3");
  const metadata = taggedBytes.toString("utf8");
  assert.match(metadata, /হ্যালো/);
  assert.match(metadata, /MOSHARROF/);
  assert.equal(link.dataset.downloadComplete, "true");
  assert.match(link.innerHTML, /ডাউনলোড সম্পন্ন/);
});

test("does not add ID3 data to non-MP3 audio and still chooses its real extension", async () => {
  const link = await createAudioDownloadButton(new Blob(["wav"], { type: "audio/wav" }), {
    title: "পরীক্ষা",
    documentRef: fakeDocument(),
    URLApi: fakeUrlApi(),
    setTimeoutFn: () => {},
    now: () => new Date("2026-11-13T00:00:00.000Z")
  });
  assert.match(link.download, /^পরীক্ষা_20261113000000_\d{3}\.wav$/);
});
