export const CODE_TTL_MS = 5 * 60 * 1000;
export const COMMAND_TTL_MS = 2 * 60 * 1000;
export const MAX_QUEUE = 10;
export const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
export const DEVICE_ID = /^[A-Za-z0-9_-]{16,128}$/;
export const ACTIONS = new Set(["INSTALL_APK", "SEARCH_PLAY_STORE", "UNINSTALL_APP"]);
export const STATUSES = new Set(["REQUESTED", "AWAITING_USER_CONFIRMATION", "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNKNOWN"]);

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
export function bearer(request) {
  const value = String(request.headers.get("authorization") || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
export function randomHex(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value, b => b.toString(16).padStart(2, "0")).join("");
}
export function fromHex(value) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("invalid hex");
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
export async function sign(secretHex, envelope) {
  const key = await crypto.subtle.importKey("raw", fromHex(secretHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const payload = [
    "mosharrof-device-command-v1", envelope.requestId, envelope.action,
    String(envelope.issuedAtMillis), String(envelope.expiresAtMillis),
    envelope.nonce, envelope.target
  ].join("\n");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
}
export function validTarget(action, target) {
  if (typeof target !== "string" || target.length > 120 || /[\u0000-\u001f\u007f]/.test(target)) return false;
  if (action === "INSTALL_APK") return target === "";
  if (action === "SEARCH_PLAY_STORE") return target.trim().length > 0;
  if (action === "UNINSTALL_APP") return PACKAGE_NAME.test(target) || /^[\p{L}\p{N}][\p{L}\p{N} ._()+-]{0,79}$/u.test(target.trim());
  return false;
}
export function terminal(status) {
  return ["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNKNOWN"].includes(status);
}
