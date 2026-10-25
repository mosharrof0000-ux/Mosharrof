import { readFile } from "node:fs/promises";

export async function loadVideoCuttingWorker() {
  const [entry, proxy] = await Promise.all([
    readFile(new URL("../worker/index.js", import.meta.url), "utf8"),
    readFile(new URL("../worker/video-cutting-proxy.js", import.meta.url), "utf8")
  ]);
  const inlineProxy = proxy
    .replace("export async function handleVideoCuttingProxy", "async function handleVideoCuttingProxy")
    .replace("export const VIDEO_CUTTING_MAX_UPLOAD_BYTES", "const VIDEO_CUTTING_MAX_UPLOAD_BYTES");
  const source = entry
    .replace(
      'import chatWorker from "./screenshot-analysis.js";',
      'const chatWorker = { async fetch() { return new Response("delegated", { status: 200 }); } };'
    )
    .replace('import { handleVideoCuttingProxy } from "./video-cutting-proxy.js";', inlineProxy);
  return (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
}
