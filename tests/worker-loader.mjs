import { readFile } from "node:fs/promises";
export async function loadWorker() {
  const [source, context, reflection, retry] = await Promise.all([
    readFile(new URL("../worker/screenshot-analysis.js",import.meta.url),"utf8"),
    readFile(new URL("../core/chat-context.js",import.meta.url),"utf8"),
    readFile(new URL("../core/reflective-chat-prompt.js",import.meta.url),"utf8"),
    readFile(new URL("../core/chat-provider-retry.js",import.meta.url),"utf8")
  ]);
  const bundled=source.replace('import { buildChatContext } from "../core/chat-context.js";',context).replace('import { buildReflectiveSystemPrompt, buildReflectiveUserPrompt } from "../core/reflective-chat-prompt.js";',reflection).replace('import { runChatUntilAnswer } from "../core/chat-provider-retry.js";',retry);
  if(bundled.includes('from "../core/'))throw new Error("Unbundled worker helper");
  return (await import("data:text/javascript;base64,"+Buffer.from(bundled).toString("base64"))).default;
}
