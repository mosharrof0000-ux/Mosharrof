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

test("creates a browser download link and keeps its blob URL alive for mobile WebViews", () => {
  const revoked = [];
  const scheduled = [];
  const URLApi = {
    createObjectURL(blob) { assert.equal(blob.size, 3); return "blob:download"; },
    revokeObjectURL(url) { revoked.push(url); }
  };
  const link = createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
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
  assert.equal(link.download, "mosharrof-message-audio-2026-11-12T00-00-00-000Z.mp3");
  assert.equal(scheduled[0].delay, 60000);
  scheduled[0].callback();
  assert.deepEqual(revoked, ["blob:download"]);
});

test("saves audio through the Android native Downloads bridge instead of relying on WebView anchor downloads", async () => {
  let saved;
  const plugin = {
    async save(payload) {
      saved = payload;
      return { saved: true, uri: "content://downloads/audio", bytes: 3 };
    }
  };
  const link = createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    documentRef: fakeDocument(),
    URLApi: { createObjectURL: () => "blob:download", revokeObjectURL: () => {} },
    nativePlugin: plugin,
    setTimeoutFn: () => {},
    now: () => new Date("2026-11-12T00:00:00.000Z")
  });
  let prevented = false;
  await link.listeners.click({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(saved.filename, "mosharrof-message-audio-2026-11-12T00-00-00-000Z.mp3");
  assert.equal(saved.mimeType, "audio/mpeg");
  assert.equal(saved.base64, "YWJj");
  assert.equal(link.dataset.downloadComplete, "true");
  assert.match(link.innerHTML, /ডাউনলোড সম্পন্ন/);
});

test("shows a visible failure when the Android native Downloads bridge rejects the save", async () => {
  const link = createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    documentRef: fakeDocument(),
    URLApi: { createObjectURL: () => "blob:download", revokeObjectURL: () => {} },
    nativePlugin: { async save() { throw new Error("storage_denied"); } },
    setTimeoutFn: () => {}
  });
  await link.listeners.click({ preventDefault() {} });
  assert.equal(link.dataset.downloadError, "true");
  assert.match(link.title, /storage_denied/);
});
