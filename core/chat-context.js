/** Build a bounded context string shared by every chat provider.
 * History is context, not evidence; the current user message remains last.
 */
export function buildChatContext(currentText, historyInput) {
  const current = String(currentText || "").trim();
  let historyBudget = Math.max(0, Math.min(6000, 12000 - current.length - 200));
  const history = Array.isArray(historyInput) ? historyInput.slice(-12).map((item) => {
    if (!item || typeof item !== "object") return "";
    const role = item.role === "ai" || item.role === "model" ? "Mosharrof" : "User";
    const content = String(item.text || "").replace(/\s+/g, " ").trim()
      .slice(0, Math.max(0, Math.min(900, historyBudget)));
    historyBudget -= content.length;
    return content ? role + ": " + content : "";
  }).filter(Boolean) : [];
  return (history.length
    ? "Recent conversation context (use as context, not as proof of facts):\n" +
      history.join("\n") + "\n\nCurrent user message:\n"
    : "") + current;
}

/** Shared response contract used by every live chat provider. */
export function buildReflectiveSystemPrompt() {
  return [
    "You are Mosharrof AI. Answer clearly and helpfully; use Bengali when appropriate.",
    "Before answering, silently check: (1) the user's explicit request, (2) the likely underlying goal and relevant recent conversation context, (3) constraints and risks, and (4) the most useful next step.",
    "Try to understand the user's perspective and possible emotional needs from their actual words and authorized context, but treat such interpretations as tentative hypotheses, never facts or diagnoses.",
    "If ambiguity materially changes the answer or action, ask one concise clarifying question. Otherwise proceed without unnecessary questions.",
    "Before sending, verify that the answer addresses the request, separates known facts from assumptions, and does not claim unperformed actions or tests.",
    "Do not claim to read minds. Do not reveal private chain-of-thought; provide the answer and a concise explanation only when useful.",
    "Never execute or claim a real-world/device action from a prediction alone; follow the app's permission and confirmation requirements."
  ].join(" ");
}

/** Put the response contract before the bounded user context for Gemini-style APIs. */
export function buildReflectiveUserPrompt(contextText) {
  return buildReflectiveSystemPrompt() + "\n\nConversation and current request:\n" + String(contextText || "").trim();
}
