import test from "node:test";
import assert from "node:assert/strict";
import { installMessageAudioActions, organId } from "../index.js";

class FakeGroup {
  constructor(owner) { this.owner = owner; this.children = []; }
  closest(selector) { return selector === ".message.user" ? this.owner : null; }
  querySelector(selector) {
    if (selector === "[data-message-audio-read]") return this.children.find((item) => item.dataset.messageAudioRead);
    if (selector === "[data-message-audio-download]") return this.children.find((item) => item.dataset.messageAudioDownload);
    return null;
  }
  appendChild(element) { this.children.push(element); element.parent = this; return element; }
}
class FakeMessage {
  constructor() { this.group = new FakeGroup(this); this.groupAvailable = true; }
  matches(selector) { return selector === ".message.user"; }
  querySelector(selector) { return selector === ".message-actions" && this.groupAvailable ? this.group : null; }
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

test("attaches read-aloud when the message action toolbar is inserted after the message", () => {
  const message = new FakeMessage();
  message.groupAvailable = false;
  const documentRef = fakeDocument([message]);
  let observer;
  class Observer extends FakeObserver {
    constructor(callback) { super(callback); observer = this; }
  }
  const controller = { async speak() { return null; }, stop() {} };
  const dispose = installMessageAudioActions({ documentRef, MutationObserverCtor: Observer, controller });

  assert.equal(message.group.children.length, 0, "toolbar is not ready when message is first inserted");
  message.groupAvailable = true;
  observer.callback([{ addedNodes: [message.group] }]);

  assert.equal(message.group.children.length, 1);
  assert.equal(message.group.children[0].dataset.messageAudioRead, "true");
  dispose();
});
