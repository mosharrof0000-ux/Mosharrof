import { createJackboxControlBox } from "../runtime/core/jackbox/index.js";

export async function initializeJackbox({ registry, runtime, reservedIds = [] } = {}) {
  try {
    const response = await fetch(new URL("../runtime/core/jackbox/registry.json", import.meta.url), { cache: "no-store" });
    if (!response.ok) throw new Error("Jackbox manifest unavailable: HTTP " + response.status);
    const manifest = await response.json();
    const jackbox = createJackboxControlBox({
      manifest,
      registry,
      runtime,
      reservedIds,
      loadModule: (id) => import(new URL("../organs/" + id + "/index.js", import.meta.url).href)
    });
    await jackbox.initialize();
    return jackbox;
  } catch (error) {
    console.error("[MOSHARROF Jackbox] optional module manager unavailable; core runtime remains active", error);
    return Object.freeze({
      list: () => [Object.freeze({ id: "jackbox", status: "quarantined", error: String(error?.message ?? error).slice(0, 240) })],
      initialize: async () => [],
      enable: async () => { throw new Error("Jackbox is unavailable; core runtime remains active"); },
      disable: async () => { throw new Error("Jackbox is unavailable; core runtime remains active"); }
    });
  }
}
