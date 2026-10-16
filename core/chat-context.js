/** Build a bounded context string shared by every chat provider.
 * Saved memory and history are context, not evidence; the current user message remains last.
 */
export function buildChatContext(currentText, historyInput, memoryInput = "") {
  const current = String(currentText || "").trim();
  if (!current) return "";
  let memory = String(memoryInput || "").trim().slice(0, 4200);
  if (memory.length + current.length > 11800) memory = memory.slice(0, Math.max(0, 11800 - current.length));
  let historyBudget = Math.max(0, Math.min(6000, 12000 - current.length - memory.length - 240));
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map((item) => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" ? "Mosharrof" : "User";
    const content = String(item.text || "").replace(/\s+/g, " ").trim()
      .slice(0, Math.max(0, Math.min(900, historyBudget)));
    historyBudget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  const historyText = history.length ? "Recent conversation context (use as context, not as proof of facts):\n" + history.join("\n") + "\n\n" : "";
  const memoryText = memory ? memory + "\n\n" : "";
  return memoryText + historyText + "Current user message:\n" + current;
}