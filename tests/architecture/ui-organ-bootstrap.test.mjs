import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the current shell loads the organ runtime through its existing script", async () => {
  const html = await readFile(new URL("../../web/index.html", import.meta.url), "utf8");
  const recovery = await readFile(new URL("../../web/sidebar-recovery.js", import.meta.url), "utf8");
  const bootstrap = await readFile(new URL("../../web/entities/organ-bootstrap.js", import.meta.url), "utf8");
  const modules = await readFile(new URL("../../web/entities/ui-organ-modules.js", import.meta.url), "utf8");
  assert.ok(html.includes('<script src="./sidebar-recovery.js"></script>'));
  assert.ok(recovery.includes('new URL("./entities/bootstrap.js", bootstrapScriptUrl).href'));
  for (const mapping of [
    'core: "core"', 'chat: "chat"', 'sidebar: "sidebar"', 'voice: "voice"',
    'storage: "storage"', 'tool_factory: "tool-factory"', 'quran_research: "quran-research"'
  ]) assert.ok(bootstrap.includes(mapping), "missing visible UI organ mapping: " + mapping);
  for (const id of ["core", "sidebar", "voice", "storage", "tool-factory", "quran-research"]) {
    assert.ok(modules.includes('../organs/' + id + '/index.js'), "missing UI organ import: " + id);
  }
});
