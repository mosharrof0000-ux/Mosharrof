/** Build a bounded context string shared by every chat provider.
 * History is context, not evidence; the current user message remains last.
 */
export function buildChatContext(currentText, historyInput, memoryContext = "", conversationSummary = "") {
  if (currentText && typeof currentText === "object") {
    const body = currentText;
    historyInput = body.history;
    memoryContext = body.memory_context;
    conversationSummary = body.conversation_summary;
    currentText = body.text;
  }
  const current = String(currentText || "").trim();
  const memory = String(memoryContext || "").trim().slice(0, Math.max(0, Math.min(3500, 12000 - current.length - 1500)));
  const summary = String(conversationSummary || "").trim().slice(0, Math.max(0, Math.min(1000, 12000 - current.length - memory.length - 1000)));
  let historyBudget = Math.max(0, Math.min(6000, 12000 - current.length - memory.length - summary.length - 500));
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map((item) => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" ? "Mosharrof" : "User";
    const content = String(item.text || "").replace(/\s+/g, " ").trim()
      .slice(0, Math.max(0, Math.min(900, historyBudget)));
    historyBudget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  if (!memory && !summary && !history.length) return current;
  return (memory ? "Relevant personal memory (dated context only; current request takes priority):\n" + memory + "\n\n" : "") +
    (summary ? "Current conversation summary (continuity only; current request takes priority):\n" + summary + "\n\n" : "") +
    (history.length ? "Recent conversation context (use as context, not as proof of facts):\n" + history.join("\n") + "\n\n" : "") +
    "Current user message:\n" + current;
}
