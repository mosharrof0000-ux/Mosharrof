import test from "node:test";
import assert from "node:assert/strict";
import { installMessageAudioActions, organId } from "../index.js";

class FakeGroup {
  constructor() { this.children = []; }
  querySelector(selector) {
    if (selector === "[data-message-audio-read]") return this.children.find((item) => item.dataset.messageAudioRead);
    if (selector === "[data-message-audio-download]") return this.children.find((item) => item.dataset.messageAudioDownload);
    return null;
  }
  appendChild(element) { this.children.push(element); element.parent = this; return element; }
}
class FakeMessage {
  constructor() { this.group = new FakeGroup(); }
  matches(selector) { return selector === ".message.user"; }
  querySelector(selector) { return selector === ".message-actions" ? this.group : null; }
}
class FakeRoot {
  constructor(messages) { this.messages = messages; }
  querySelectorAll(selector) { return selector === ".message.user" ? this.messages : []; }
}
class FakeObserver {
  constructor(callback) { this.callback = callback; this.disconnected = false; }
  observe(root, options) { this.root = root; this.options = options; }
  disconnect() { this.disconnected = true; }
}
function fakeDocument(messages) {
  return {
    body: new FakeRoot(messages),
    createElement() {
      return {
        dataset: {}, listeners: {},
        setAttribute(name, value) { this[name] = value; },
        addEventListener(name, callback) { this.listeners[name] = callback; }
      };
    }
  };
}

test("installs read-aloud only in sent-message action groups and remains idempotent", () => {
  const message = new FakeMessage();
  const documentRef = fakeDocument([message]);
  let observer;
  class Observer extends FakeObserver {
    constructor(callback) { super(callback); observer = this; }
  }
  const controller = { async speak() { return null; }, stop() {} };
  const dispose = installMessageAudioActions({ documentRef, MutationObserverCtor: Observer, controller });
  assert.equal(organId, "message-audio");
  assert.equal(message.group.children.length, 1);
  assert.equal(message.group.children[0].dataset.messageAudioRead, "true");
  observer.callback([{ addedNodes: [message] }]);
  assert.equal(message.group.children.length, 1);
  assert.deepEqual(observer.options, { childList: true, subtree: true });
  dispose();
  assert.equal(observer.disconnected, true);
});
