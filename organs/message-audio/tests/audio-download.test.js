import test from "node:test";
import assert from "node:assert/strict";
import { createAudioDownloadButton } from "../components/audio-download.js";

test("creates a download control for generated MP3 audio and revokes its URL", () => {
  const created = [];
  const revoked = [];
  const scheduled = [];
  const documentRef = {
    body: { appendChild(element) { element.parent = this; } },
    createElement(tag) {
      const element = {
        tag, style: {}, listeners: {}, removed: false,
        setAttribute(name, value) { this[name] = value; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        click() { this.clicked = true; },
        remove() { this.removed = true; }
      };
      created.push(element);
      return element;
    }
  };
  const URLApi = {
    createObjectURL(blob) { assert.equal(blob.size, 3); return "blob:download"; },
    revokeObjectURL(url) { revoked.push(url); }
  };
  const button = createAudioDownloadButton(new Blob(["abc"], { type: "audio/mpeg" }), {
    documentRef,
    URLApi,
    setTimeoutFn: (callback, delay) => scheduled.push({ callback, delay }),
    now: () => new Date("2026-11-12T00:00:00.000Z")
  });
  assert.equal(button.dataset.messageAudioDownload, "true");
  assert.match(button.textContent, /ডাউনলোড/);
  let stopped = false;
  button.listeners.click({ stopPropagation() { stopped = true; } });
  const link = created.find((element) => element.tag === "a");
  assert.equal(stopped, true);
  assert.equal(link.download, "mosharrof-message-audio-2026-11-12T00-00-00-000Z.mp3");
  assert.equal(link.clicked, true);
  assert.equal(link.removed, true);
  assert.equal(scheduled[0].delay, 1500);
  scheduled[0].callback();
  assert.deepEqual(revoked, ["blob:download"]);
});
