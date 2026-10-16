import test from "node:test";
import assert from "node:assert/strict";
import { buildChatContext } from "../core/chat-context.js";

test("retrieved memory is labeled historical and current request remains last", () => {
  const context = buildChatContext("এখন ছোট করে বলুন", [{ role: "user", text: "আগে বিস্তারিত চাইতাম" }], "Old preference: detailed answers");
  assert.match(context, /Relevant saved memory \(historical context only; current request overrides it\)/);
  assert.match(context, /Old preference: detailed answers/);
  assert.ok(context.lastIndexOf("Current user message:") > context.indexOf("Old preference"));
  assert.ok(context.endsWith("এখন ছোট করে বলুন"));
});
test("memory is bounded and cannot displace the current user message", () => {
  const current = "CURRENT REQUEST";
  const context = buildChatContext(current, [], "past ".repeat(5000));
  assert.ok(context.length < 4000);
  assert.ok(context.endsWith(current));
});
test("context stays bounded with long current messages", () => {
  const current = "x".repeat(11900);
  const context = buildChatContext(current, [], "old memory ".repeat(500));
  assert.ok(context.length <= 12000);
  assert.ok(context.endsWith(current));
});
