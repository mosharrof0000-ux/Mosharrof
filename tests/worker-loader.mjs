import { readFile } from "node:fs/promises";
export async function loadWorker() {
  const paths=["worker/screenshot-analysis.js","core/chat-context.js","core/reflective-chat-prompt.js","core/chat-provider-retry.js","core/image-spec.js","core/personal-memory-engine.js"];
  const [source,context,reflection,retry,imageSpec,memory]=await Promise.all(paths.map(p=>readFile(new URL("../"+p,import.meta.url),"utf8")));
  const bundled=source.replace('import { buildChatContext } from "../core/chat-context.js";',context).replace('import { buildReflectiveSystemPrompt, buildReflectiveUserPrompt } from "../core/reflective-chat-prompt.js";',reflection).replace('import { runChatUntilAnswer, withChatProviderTimeout } from "../core/chat-provider-retry.js";',retry).replace('import { parseImageSpec } from "../core/image-spec.js";',imageSpec).replace('import { buildPersonalMemoryContext, inferMemoryCandidates } from "../core/personal-memory-engine.js";',memory);
  if(bundled.includes('from "../core/'))throw new Error("Unbundled worker helper");
  return (await import("data:text/javascript;base64,"+Buffer.from(bundled).toString("base64"))).default;
}
