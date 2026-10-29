/* Explicit chat sizing for older Android System WebView flex layouts. */
const STYLE_ID = "mosharrof-chat-layout-compat";

function forceViewportChatSizing() {
  const scroll = document.getElementById("chatScroll");
  const messages = document.getElementById("messages");
  if (scroll) {
    // The failing APK measured the scroll container as a narrow flex item.
    // Anchor it to the viewport so percentage descendants cannot inherit that width.
    scroll.style.setProperty("width", "100vw", "important");
    scroll.style.setProperty("max-width", "100vw", "important");
    scroll.style.setProperty("left", "0", "important");
    scroll.style.setProperty("right", "auto", "important");
  }
  if (messages) {
    messages.style.setProperty("width", "calc(100vw - 28px)", "important");
    messages.style.setProperty("max-width", "900px", "important");
    messages.style.setProperty("min-width", "0", "important");
    messages.style.setProperty("flex", "0 0 auto", "important");
    messages.style.setProperty("align-self", "center", "important");
    messages.style.setProperty("box-sizing", "border-box", "important");
    messages.style.setProperty("margin-left", "auto", "important");
    messages.style.setProperty("margin-right", "auto", "important");
  }
}

export function applyChatLayoutCompatibility() {
  if (!document.head) throw new Error("Chat layout compatibility requires document.head");
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #chatScroll {
        width: 100vw !important;
        max-width: 100vw !important;
        left: 0 !important;
        right: auto !important;
      }
      #chatScroll > #messages {
        width: calc(100vw - 28px) !important;
        max-width: 900px !important;
        min-width: 0 !important;
        flex: 0 0 auto !important;
        align-self: center !important;
        box-sizing: border-box !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }
      #chatScroll > #messages > .message.ai,
      #chatScroll > #messages > .message.user {
        width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        flex: 0 0 auto !important;
      }
      #chatScroll > #messages > .message.ai { max-width: 92% !important; }
      #chatScroll > #messages > .message.user { max-width: 80% !important; }
    `;
    document.head.appendChild(style);
  }
  forceViewportChatSizing();
  window.__mosharrofChatLayoutCompatReady = true;
  return true;
}
