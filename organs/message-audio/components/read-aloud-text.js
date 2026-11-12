export function normalizeSpeechText(value) {
  return String(value == null ? "" : value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~>#|]/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

export function extractMessageText(message) {
  if (!message) return "";
  let source = message;
  if (typeof message.cloneNode === "function") {
    source = message.cloneNode(true);
    if (typeof source.querySelectorAll === "function") {
      source.querySelectorAll(".message-actions-wrap,.message-actions,.message-actions-toggle,.message-action,.message-meta-row,.time,.label")
        .forEach((element) => element.remove());
    }
  }
  return normalizeSpeechText(source.innerText || source.textContent || "");
}

