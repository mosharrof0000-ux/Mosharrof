import test from "node:test";
import assert from "node:assert/strict";
import { extractMessageText, normalizeSpeechText } from "../components/read-aloud-text.js";

test("speech text removes markdown syntax while retaining visible words", () => {
  assert.equal(normalizeSpeechText("**বাংলা** [লিংক](https://example.com) `কোড`"), "বাংলা লিংক কোড");
});

test("message extraction excludes action controls from cloned message content", () => {
  const removed = [];
  const clone = {
    innerText: "আমি বলছি",
    querySelectorAll(selector) {
      assert.match(selector, /message-actions/);
      return [{ remove() { removed.push(true); } }];
    }
  };
  const message = { cloneNode(deep) { assert.equal(deep, true); return clone; } };
  assert.equal(extractMessageText(message), "আমি বলছি");
  assert.equal(removed.length, 1);
});

test("message extraction safely handles missing and plain-text input", () => {
  assert.equal(extractMessageText(null), "");
  assert.equal(extractMessageText({ textContent: "  সাধারণ লেখা  " }), "সাধারণ লেখা");
});
