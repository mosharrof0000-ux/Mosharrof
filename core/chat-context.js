/** Build a bounded context string shared by every chat provider.
 * Memory and history are dated context, not proof or current instructions.
 * The current user message always remains last and takes priority.
 */
export function buildChatContext(currentText, historyInput, memoryInput = "") {
  const current = String(currentText || "").trim();
  const memoryBudget = Math.max(0, Math.min(2500, 9000 - current.length));
  const memory = String(memoryInput || "").trim().slice(0, memoryBudget);
  let historyBudget = Math.max(0, Math.min(memory ? 3000 : 6000, 12000 - current.length - memory.length - 200));
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map((item) => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" || item.role === "assistant" ? "Mosharrof" : "User";
    const content = String(item.text || "").replace(/\\s+/g, " ").trim()
      .slice(0, Math.max(0, Math.min(900, historyBudget)));
    historyBudget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  const sections = [];
  if (memory) sections.push("Relevant saved memory (historical context only; current request overrides it):\\n" + memory);
  if (history.length) sections.push("Recent conversation context (use as context, not as proof of facts):\\n" + history.join("\\n"));
  sections.push("Current user message:\\n" + current);
  return sections.join("\\n\\n");
}
