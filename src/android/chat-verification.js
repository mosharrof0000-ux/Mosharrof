/**
 * Android WebView Chat Verification
 * Ensures live chat is active before screenshot evidence is captured.
 */
export async function verifyLiveChat(webview) {
  const isReady = await webview.evaluate(() => {
    const chat = document.querySelector("#chat-scroll");
    return !!chat && chat.children.length > 0;
  });
  if (!isReady) {
    throw new Error("CHAT_NOT_READY_FOR_EVIDENCE");
  }
  return true;
}