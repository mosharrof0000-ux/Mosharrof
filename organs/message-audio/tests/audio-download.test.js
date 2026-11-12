import test from "node:test";
import assert from "node:assert/strict";
import { createAudioDownloadButton } from "../components/audio-download.js";

test("creates a direct user-activated download link and keeps its blob URL alive for mobile WebViews", () => {
  const created = [];
  const revoked = [];
  const scheduled = [];
  const documentRef = {
    createElement(tag) {
      const element = {
        tag, style: {}, dataset: {},
        setAttribute(name, value) { this[name] = value; }
      };
      created.push(element);
      return element;
    }
  };
  const URLApi = {
    createObjectURL(blob) { assert.equal(blob.size, 3); return "blob:download"; },
    revokeObjectURL(url) { revoked.push(url); }
  };
  const link = createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    documentRef,
    URLApi,
    setTimeoutFn: (callback, delay) => scheduled.push({ callback, delay }),
    now: () => new Date("2026-11-12T00:00:00.000Z")
  });
  assert.equal(link.dataset.messageAudioDownload, "true");
  assert.match(link.innerHTML, /<svg/);
  assert.match(link.innerHTML, /অডিও ডাউনলোড/);
  assert.equal(link.href, "blob:download");
  assert.equal(link.download, "mosharrof-message-audio-2026-11-12T00-00-00-000Z.mp3");
  assert.equal(link.getAttribute ? link.getAttribute("download") : link.download, link.download);
  assert.equal(scheduled[0].delay, 60000);
  scheduled[0].callback();
  assert.deepEqual(revoked, ["blob:download"]);
});
