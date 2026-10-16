import { buildChatContextWithMemory } from "./chat-memory-context.js";

export function buildChatContext(currentText, historyInput, memoryContext = "") {
  return buildChatContextWithMemory(currentText, historyInput, memoryContext);
}
