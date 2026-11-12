import test from "node:test";
import assert from "node:assert/strict";
import { installMessageAudioActions } from "../index.js";

test("adds read-aloud when the action toolbar mounts after its sent message", () => {
  const children = [];
  const group = {
    closest: () => message,
    querySelector: (s) => children.find((x) => s === "[data-message-audio-read]" && x.dataset.messageAudioRead),
    appendChild: (x) => children.push(x)
  };
  let toolbarReady = false;
  const message = {
    matches: (s) => s === ".message.user",
    querySelector: (s) => s === ".message-actions" && toolbarReady ? group : null
  };
  let observer;
  class Observer {
    constructor(cb) { this.cb = cb; observer = this; }
    observe() {}
    disconnect() {}
  }
  const documentRef = {
    body: { querySelectorAll: () => [message] },
    createElement: () => ({ dataset: {}, setAttribute() {}, addEventListener() {} })
  };
  const dispose = installMessageAudioActions({
    documentRef, MutationObserverCtor: Observer, controller: { speak: async () => null, stop() {} }
  });
  assert.equal(children.length, 0);
  toolbarReady = true;
  observer.cb([{ addedNodes: [group] }]);
  assert.equal(children.length, 1);
  assert.equal(children[0].dataset.messageAudioRead, "true");
  dispose();
});
