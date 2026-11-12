import test from "node:test";
import assert from "node:assert/strict";
import { createAudioDownloadButton } from "../components/audio-download.js";

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

test("creates a browser download link and keeps its tagged blob URL alive for mobile WebViews", async () => {
  const revoked = [];
  const scheduled = [];
  const URLApi = {
    createObjectURL(blob) { assert.ok(blob.size > 3); return "blob:download"; },
    revokeObjectURL(url) { revoked.push(url); }
  };
  const link = await createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    title: "আপনি কেমন আছেন?",
    documentRef: fakeDocument(),
    URLApi,
    nativePlugin: null,
    setTimeoutFn: (callback, delay) => scheduled.push({ callback, delay }),
    now: () => new Date("2026-11-12T00:00:00.000Z")
  });
  assert.equal(link.dataset.messageAudioDownload, "true");
  assert.match(link.innerHTML, /<svg/);
  assert.match(link.innerHTML, /অডিও ডাউনলোড/);
  assert.equal(link.href, "blob:download");
  assert.match(link.download, /^আপনি_কেমন_আছেন_20261112000000_\d{3}\.mp3$/);
  assert.equal(link.dataset.audioTitle, "আপনি কেমন আছেন?");
  assert.equal(scheduled[0].delay, 60000);
  scheduled[0].callback();
  assert.deepEqual(revoked, ["blob:download"]);
});

test("saves tagged audio through the Android native Downloads bridge instead of relying on WebView anchor downloads", async () => {
  let saved;
  const plugin = {
    async save(payload) {
      saved = payload;
      return { saved: true, uri: "content://downloads/audio", bytes: 3 };
    }
  };
  const link = await createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    title: "হ্যালো",
    documentRef: fakeDocument(),
    URLApi: { createObjectURL: () => "blob:download", revokeObjectURL: () => {} },
    nativePlugin: plugin,
    setTimeoutFn: () => {},
    now: () => new Date("2026-11-12T00:00:00.000Z")
  });
  let prevented = false;
  await link.listeners.click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(saved.filename, /^হ্যালো_20261112000000_\d{3}\.mp3$/);
  assert.equal(saved.mimeType, "audio/mpeg");
  const bytes = Buffer.from(saved.base64, "base64");
  assert.equal(bytes.subarray(0, 3).toString("ascii"), "ID3");
  assert.ok(bytes.toString("utf8").includes("MOSHARROF"));
  assert.equal(link.dataset.downloadComplete, "true");
  assert.match(link.innerHTML, /ডাউনলোড সম্পন্ন/);
});

test("shows a visible failure when the Android native Downloads bridge rejects the save", async () => {
  const link = await createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    title: "পরীক্ষা",
    documentRef: fakeDocument(),
    URLApi: { createObjectURL: () => "blob:download", revokeObjectURL: () => {} },
    nativePlugin: { async save() { throw new Error("storage_denied"); } },
    setTimeoutFn: () => {}
  });
  await link.listeners.click({ preventDefault() {} });
  assert.equal(link.dataset.downloadError, "true");
  assert.match(link.title, /storage_denied/);
});
