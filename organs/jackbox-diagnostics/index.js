let initialized = false;
let disposed = false;

export const organId = "jackbox-diagnostics";

export function initialize(runtime) {
  disposed = false;
  initialized = true;
  runtime.reportSuccess("Jackbox diagnostics module initialized");
  return Object.freeze({ id: organId, status: "initialized" });
}

export function getHealth(runtime) {
  return Object.freeze({
    ...runtime.health(),
    moduleId: organId,
    initialized,
    disposed,
  });
}

export function reportIssue(runtime, summary = "Jackbox diagnostics issue") {
  return runtime.reportIssue(summary);
}

export function runSelfCheck(runtime, payload = {}) {
  const health = runtime.health();
  return Object.freeze({
    ok: initialized && !disposed && health.enabled === true,
    moduleId: organId,
    enabled: health.enabled === true,
    requestId: typeof payload.requestId === "string" ? payload.requestId.slice(0, 80) : null,
  });
}

export function dispose(runtime) {
  disposed = true;
  initialized = false;
  runtime.reportSuccess("Jackbox diagnostics module disposed");
  return Object.freeze({ id: organId, status: "disposed" });
}
