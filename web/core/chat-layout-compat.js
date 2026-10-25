/* Explicit chat sizing for older Android System WebView flex layouts. */
const STYLE_ID = "mosharrof-chat-layout-compat";

export function applyChatLayoutCompatibility() {
  if (!document.head) throw new Error("Chat layout compatibility requires document.head");
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #chatScroll > #messages {
        width: 100%;
        max-width: 900px;
        flex: 0 0 auto;
        margin-left: auto;
        margin-right: auto;
      }
      #chatScroll > #messages > .message.ai,
      #chatScroll > #messages > .message.user {
        width: 100%;
        min-width: 1px;
      }
      #chatScroll > #messages > .message.ai { max-width: 92%; }
      #chatScroll > #messages > .message.user { max-width: 80%; }
    `;
    document.head.appendChild(style);
  }
  window.__mosharrofChatLayoutCompatReady = true;
  return true;
}
