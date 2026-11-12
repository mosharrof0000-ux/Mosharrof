export const organId = "personal-voice";

export function initialize(runtime) {
  runtime.reportSuccess(organId, "Personal voice domain and authenticated Worker API initialized");
  return Object.freeze({ id: organId, status: "initialized" });
}

export function getHealth(runtime) {
  return runtime.health(organId);
}

export function reportIssue(runtime, summary = "personal voice issue reported") {
  return runtime.reportIssue(organId, summary);
}

export { getProviderControlCapabilities } from "./domain/provider-capabilities.js";
