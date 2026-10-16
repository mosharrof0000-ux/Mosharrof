export function buildChatContext(input, historyInput, memoryContext = "", summaryText = "") {
  if (input && typeof input === "object") {
    historyInput = input.history;
    memoryContext = input.memory_context;
    summaryText = input.conversation_summary;
    input = input.text;
  }
  const current = String(input || "").trim();
  const room = Math.max(0, 12000 - current.length - 450);
  const memory = String(memoryContext || "").trim().slice(0, Math.min(3500, room));
  const summary = String(summaryText || "").trim().slice(0, Math.min(1000, Math.max(0, room - memory.length)));
  let budget = Math.max(0, Math.min(6000, room - memory.length - summary.length));
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map(item => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" ? "Mosharrof" : "User";
    const content = String(item.text || "").replace(/\s+/g, " ").trim().slice(0, Math.min(900, budget));
    budget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  if (!memory && !summary && !history.length) return current;
  return [
    memory && "Relevant personal memory (historical only; current request wins):\n" + memory,
    summary && "Current chat summary (context only):\n" + summary,
    history.length && "Recent conversation history:\n" + history.join("\n"),
    "Current user message:\n" + current
  ].filter(Boolean).join("\n\n");
}
