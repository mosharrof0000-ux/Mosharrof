import { buildPersonalMemoryContext, inferMemoryCandidates } from "./personal-memory-engine.js";
import { buildReflectiveUserPrompt } from "./reflective-chat-prompt.js";

export function buildChatMemoryPrompt(body, text, targetWords = 0) {
  const memoryContext = typeof body.memory_context === "string"
    ? body.memory_context.slice(0, 9000)
    : buildPersonalMemoryContext(body.personal_memory, text);
  const memoryCandidates = inferMemoryCandidates(body.text);
  const outputInstruction = targetWords
    ? "\n\nOUTPUT LENGTH REQUIREMENT: Aim for approximately " + targetWords + " words. Continue the requested story or text in full, with coherent structure and no premature summary. Do not claim the target was met if output is cut off."
    : "";
  const contextualText = (memoryContext ? memoryContext + "\n\n" : "") + text + outputInstruction;
  return { userPrompt: buildReflectiveUserPrompt(contextualText), contextualText, memoryCandidates };
}
