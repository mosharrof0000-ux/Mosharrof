/** Build bounded context for every provider. Current user request always has priority. */
export function buildChatContext(currentText, historyInput, options = {}) {
  if (currentText && typeof currentText === "object") {
    const body = currentText;
    options = { memoryContext: body.memory_context, conversationSummary: body.conversation_summary };
    historyInput = body.history;
    currentText = body.text;
  }
  const current = String(currentText || "").trim();
  const available = Math.max(0, 12000 - current.length - 180);
  let remaining = available;
  const memory = String(options.memoryContext || "").trim().slice(0, Math.min(3000, remaining));
  remaining -= memory.length;
  const summary = String(options.conversationSummary || "").trim().slice(0, Math.min(1000, remaining));
  remaining -= summary.length;
  let historyBudget = Math.max(0, Math.min(6000, remaining));
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map((item) => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" ? "MOSHARROF" : "User";
    const content = String(item.text || "").replace(/\s+/g, " ").trim()
      .slice(0, Math.max(0, Math.min(900, historyBudget)));
    historyBudget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  const sections = [];
  if (memory) sections.push("Relevant saved memories (historical context only; current user request overrides old preferences or plans):\n" + memory);
  if (summary) sections.push("Current conversation summary (for continuity, not a higher priority than the current message):\n" + summary);
  if (history.length) sections.push("Recent conversation history:\n" + history.join("\n"));
  sections.push("CURRENT USER MESSAGE (highest priority):\n" + current);
  return sections.join("\n\n").slice(0, Math.max(current.length, 12000));
}
