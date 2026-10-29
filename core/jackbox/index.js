const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateManifest(manifest, registry, reservedIds) {
  if (!manifest || manifest.schema_version !== 1 || !Array.isArray(manifest.modules)) {
    throw new TypeError("Jackbox manifest must use schema_version 1 and a modules array");
  }
  const seen = new Set();
  return manifest.modules.map((item) => {
    if (!item || typeof item.id !== "string" || !ID_RE.test(item.id)) {
      throw new TypeError("Jackbox module id must be lowercase kebab-case");
    }
    if (seen.has(item.id)) throw new Error("Duplicate Jackbox module id: " + item.id);
    seen.add(item.id);
    if (reservedIds.has(item.id)) throw new Error("Jackbox module is already loaded by the host: " + item.id);
    if (typeof item.enabled !== "boolean") throw new TypeError(item.id + ": enabled must be a boolean");
    const expectedPath = "organs/" + item.id;
    const expectedEntry = expectedPath + "/index.js";
    if (item.path !== expectedPath || item.entry !== expectedEntry) {
      throw new Error(item.id + ": Jackbox paths must stay inside " + expectedPath);
    }
    if (!registry.has(item.id)) throw new Error(item.id + ": organ is missing from the validated organ registry");
    return Object.freeze({ id: item.id, path: expectedPath, entry: expectedEntry, enabled: item.enabled });
  });
}

/**
 * Controls optional organ modules through the existing contract-gated runtime.
 * The host supplies a safe importer; this module never imports arbitrary manifest URLs.
 */
export function createJackboxControlBox({
  manifest,
  registry,
  runtime,
  loadModule,
  reservedIds = [],
} = {}) {
  if (!registry || typeof registry.has !== "function" || typeof registry.get !== "function") {
    throw new TypeError("Jackbox requires a validated organ registry");
  }
  if (!runtime || typeof runtime.forOrgan !== "function" || typeof runtime.setEnabled !== "function" ||
      typeof runtime.isEnabled !== "function" || typeof runtime.invoke !== "function") {
    throw new TypeError("Jackbox requires an enable-aware organ runtime");
  }
  if (typeof loadModule !== "function") throw new TypeError("Jackbox requires a host-controlled module loader");
  const reserved = new Set(reservedIds);
  const modules = validateManifest(manifest, registry, reserved);
  const byId = new Map(modules.map((item) => [item.id, item]));
  const attached = new Map();
  const quarantined = new Map();

  function requireModule(id) {
    const item = byId.get(id);
    if (!item) throw new Error("Unknown Jackbox module: " + id);
    return item;
  }

  async function enable(id) {
    const item = requireModule(id);
    if (attached.has(id)) {
      runtime.setEnabled(id, true);
      quarantined.delete(id);
      return Object.freeze({ id, status: "enabled", alreadyAttached: true });
    }
    let module;
    let scoped;
    try {
      module = await loadModule(id);
      if (!module || module.organId !== id || typeof module.initialize !== "function" ||
          typeof module.getHealth !== "function" || typeof module.reportIssue !== "function" ||
          typeof module.dispose !== "function") {
        throw new TypeError(id + ": module must export matching organId, initialize, getHealth, reportIssue, and dispose");
      }
      const organ = registry.get(id);
      for (const api of organ.public_api) {
        if (api !== "getHealth" && api !== "reportIssue" && typeof module[api] !== "function") {
          throw new TypeError(id + ": missing function for declared public API " + api);
        }
      }
      runtime.setEnabled(id, true);
      scoped = runtime.forOrgan(id);
      await module.initialize(scoped);
      const handlers = {};
      for (const api of organ.public_api) {
        if (api === "getHealth") handlers[api] = () => module.getHealth(scoped);
        else if (api === "reportIssue") handlers[api] = (payload = {}) =>
          module.reportIssue(scoped, payload.summary ?? "issue reported by authorized caller");
        else handlers[api] = (payload = {}) => module[api](scoped, payload);
      }
      scoped.register(handlers);
      attached.set(id, { module, scoped });
      quarantined.delete(id);
      runtime.reportSuccess(id, "Jackbox module enabled");
      return Object.freeze({ id, status: "enabled", alreadyAttached: false });
    } catch (error) {
      try { if (module && scoped) await module.dispose(scoped); } catch { /* quarantine remains authoritative */ }
      runtime.setEnabled(id, false);
      runtime.reportIssue(id, "Jackbox module quarantined after attach failure");
      quarantined.set(id, String(error?.message ?? error).slice(0, 240));
      throw error;
    }
  }

  async function disable(id) {
    requireModule(id);
    const current = attached.get(id);
    let disposeError = null;
    runtime.setEnabled(id, false);
    if (current) {
      try { await current.module.dispose(current.scoped); }
      catch (error) { disposeError = String(error?.message ?? error).slice(0, 240); }
      attached.delete(id);
    }
    if (disposeError) {
      quarantined.set(id, "dispose failed: " + disposeError);
      runtime.reportIssue(id, "Jackbox module disabled after dispose failure");
      return Object.freeze({ id, status: "quarantined", error: disposeError });
    }
    quarantined.delete(id);
    return Object.freeze({ id, status: "disabled" });
  }

  async function initialize() {
    const results = [];
    for (const item of modules) {
      if (!item.enabled) {
        runtime.setEnabled(item.id, false);
        results.push(Object.freeze({ id: item.id, status: "disabled" }));
        continue;
      }
      try { results.push(await enable(item.id)); }
      catch (error) {
        results.push(Object.freeze({ id: item.id, status: "quarantined", error: String(error?.message ?? error).slice(0, 240) }));
      }
    }
    return results;
  }

  function list() {
    return modules.map((item) => Object.freeze({
      id: item.id,
      path: item.path,
      status: quarantined.has(item.id) ? "quarantined" : attached.has(item.id) && runtime.isEnabled(item.id) ? "enabled" : "disabled",
      error: quarantined.get(item.id) ?? null,
    }));
  }

  return Object.freeze({ initialize, enable, disable, list });
}
