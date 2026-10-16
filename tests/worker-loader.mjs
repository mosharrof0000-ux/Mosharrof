import { readFile } from "node:fs/promises";

export async function loadWorker() {
  const [source, helper] = await Promise.all([
    readFile(new URL("../worker/screenshot-analysis.js", import.meta.url), "utf8"),
    readFile(new URL("../core/chat-context.js", import.meta.url), "utf8")
  ]);
  const importLine = 'import { buildChatContext } from "../core/chat-context.js";';
  if (!source.includes(importLine)) throw new Error("Worker chat-context import anchor missing");
  const bundledSource = source.replace(importLine, helper);
  const moduleUrl = "data:text/javascript;base64," + Buffer.from(bundledSource).toString("base64");
  return (await import(moduleUrl)).default;
}
