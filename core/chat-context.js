/** Build a bounded context string shared by every chat provider.
 * History is context, not evidence; the current user message remains last.
 */
export function buildChatContext(currentText, historyInput, memoryContext = "") {
  const current = String(currentText || "").trim();
  const memory = String(memoryContext || "").trim().slice(0, Math.max(0, Math.min(4000, 12000 - current.length - 1200)));
  let historyBudget = Math.max(0, Math.min(6000, 12000 - current.length - memory.length - 200));
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map((item) => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" ? "Mosharrof" : "User";
    const content = String(item.text || "").replace(/\s+/g, " ").trim()
      .slice(0, Math.max(0, Math.min(900, historyBudget)));
    historyBudget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  return (memory ? "Relevant personal memory (dated context only; current request takes priority):\n" + memory + "\n\n" : "") +
    (history.length ? "Recent conversation context (use as context, not as proof of facts):\n" + history.join("\n") + "\n\n" : "") +
    (memory || history.length ? "Current user message:\n" : "") + current;
}
