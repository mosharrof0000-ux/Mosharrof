import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createOrganRegistry } from "../../core/organ-registry/index.js";
import { createLinkManager } from "../../core/link-manager/index.js";
import { createOrganRuntime } from "../../core/organ-runtime/index.js";
import * as CoreOrgan from "../../organs/core/index.js";
import * as SidebarOrgan from "../../organs/sidebar/index.js";
import * as VoiceOrgan from "../../organs/voice/index.js";
import * as StorageOrgan from "../../organs/storage/index.js";
import * as ToolFactoryOrgan from "../../organs/tool-factory/index.js";
import * as QuranResearchOrgan from "../../organs/quran-research/index.js";
import * as UiOrgan from "../../organs/ui/index.js";
const organs=[CoreOrgan, SidebarOrgan, VoiceOrgan, StorageOrgan, ToolFactoryOrgan, QuranResearchOrgan, UiOrgan];
test("legacy core, navigation, voice, storage, tool, Quran research, and UI domains have separate organ contracts", async()=>{
 const artifact=JSON.parse(await readFile(new URL("../../web/runtime/organs.registry.json",import.meta.url),"utf8"));
 const registry=createOrganRegistry(artifact.organs);
 const runtime=createOrganRuntime({registry,linkManager:createLinkManager(registry)});
 assert.equal(organs.length,7);
 for(const organ of organs){
  assert.ok(registry.get(organ.organId), "missing "+organ.organId);
  const scoped=runtime.forOrgan(organ.organId);
  organ.initialize(scoped);
  scoped.register({
   getHealth:()=>organ.getHealth(scoped),
   reportIssue:(payload={})=>organ.reportIssue(scoped,payload.summary??"test issue")
  });
  scoped.memory.set("health-check",{ready:true});
  assert.deepEqual(scoped.memory.get("health-check"),{ready:true});
  assert.equal(scoped.health().status,"ready");
 }
});
test("a domain organ's issue stays within its own health namespace",()=>{
 const registry=createOrganRegistry(organs.map(organ=>({id:organ.organId,public_api:["getHealth","reportIssue"],dependencies:[]})));
 const runtime=createOrganRuntime({registry,linkManager:createLinkManager(registry)});
 runtime.forOrgan("voice").reportIssue("simulated voice issue");
 assert.equal(runtime.health("voice").status,"degraded");
 assert.equal(runtime.health("storage").status,"registered");
});
