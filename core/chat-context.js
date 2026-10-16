/** Build a bounded context string shared by every chat provider.
 * History is context, not evidence; the current user message remains last.
 */
export function buildChatContext(currentText, historyInput) {
  let historyBudget = 6000;
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map((item) => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" ? "Mosharrof" : "User";
    const content = String(item.text || "").replace(/\s+/g, " ").trim()
      .slice(0, Math.max(0, Math.min(900, historyBudget)));
    historyBudget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  const current = String(currentText || "").trim();
  return (history.length
    ? "Recent conversation context (use as context, not as proof of facts):\n" +
      history.join("\n") + "\n\nCurrent user message:\n"
    : "") + current;
}
