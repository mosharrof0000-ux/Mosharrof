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


export class DeviceBridgeBase {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/device/pair/start") return await this.pairStart(request);
      if (request.method === "POST" && url.pathname === "/device/pair/approve") return await this.pairApprove(request);
      if (request.method === "GET" && url.pathname === "/device/pair/status") return await this.pairStatus(request);
      if (request.method === "GET" && url.pathname === "/device/poll") return await this.poll(request);
      if (request.method === "POST" && url.pathname === "/device/commands") return await this.createCommand(request);
      if (request.method === "POST" && url.pathname === "/device/result") return await this.submitResult(request);
      if (request.method === "GET" && url.pathname === "/device/results") return await this.getResult(request, url);
      if (request.method === "POST" && url.pathname === "/device/revoke") return await this.revoke(request);
      return json({ ok: false, error: "not_found" }, 404);
    } catch {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
  }

  async pairStart(request) {
    const body = await request.json();
    const deviceId = String(body.deviceId || "");
    const pairingCode = String(body.pairingCode || "");
    const deviceSecret = String(body.deviceSecret || "").toLowerCase();
    if (!DEVICE_ID.test(deviceId) || !/^\d{6}$/.test(pairingCode) || !/^[0-9a-f]{64}$/.test(deviceSecret)) {
      return json({ ok: false, error: "malformed_pair_request" }, 400);
    }
    const existing = await this.storage.get("pairing");
    if (existing && existing.approved) {
      return json({ ok: false, error: "device_already_paired_revoke_first" }, 409);
    }
    if (existing && !existing.approved && existing.expiresAt > Date.now() && existing.deviceId !== deviceId) {
      return json({ ok: false, error: "pairing_already_pending" }, 409);
    }
    const ip = String(request.headers.get("CF-Connecting-IP") || "unknown");
    const rateKey = "pairStartRate:" + await sha256(ip);
    const rate = await this.storage.get(rateKey);
    const now = Date.now();
    const activeRate = rate && rate.resetAt > now ? rate : { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (activeRate.count >= 5) return json({ ok: false, error: "pair_start_rate_limited" }, 429);
    activeRate.count += 1;
    await this.storage.put(rateKey, activeRate);
    await this.storage.put("pairing", {
      deviceId, pairingCode, secretHash: await sha256(deviceSecret), deviceSecret,
      createdAt: Date.now(), expiresAt: Date.now() + CODE_TTL_MS,
      approved: false, browserTokenHash: null, attempts: 0
    });
    return json({ ok: true, deviceId, expiresAt: Date.now() + CODE_TTL_MS });
  }

  async pairApprove(request) {
    const body = await request.json();
    const code = String(body.pairingCode || "");
    const pairing = await this.storage.get("pairing");
    if (!pairing || pairing.approved || pairing.expiresAt <= Date.now()) {
      return json({ ok: false, error: "pairing_code_expired_or_unavailable" }, 410);
    }
    if (!/^\d{6}$/.test(code) || code !== pairing.pairingCode) {
      pairing.attempts = (pairing.attempts || 0) + 1;
      if (pairing.attempts >= 5) await this.storage.delete("pairing");
      else await this.storage.put("pairing", pairing);
      return json({ ok: false, error: "pairing_code_invalid" }, 401);
    }
    const browserToken = randomHex(32);
    pairing.approved = true;
    pairing.pairingCode = null;
    pairing.browserTokenHash = await sha256(browserToken);
    pairing.approvedAt = Date.now();
    await this.storage.put("pairing", pairing);
    return json({ ok: true, deviceId: pairing.deviceId, browserToken });
  }

  async pairStatus(request) {
    const pairing = await this.authorizeDevice(request);
    if (!pairing) return json({ ok: false, error: "device_not_authorized" }, 401);
    return json({ ok: true, paired: !!pairing.approved, deviceId: pairing.deviceId, expiresAt: pairing.expiresAt });
  }

  async authorizeDevice(request) {
    const pairing = await this.storage.get("pairing");
    if (!pairing || pairing.expiresAt <= Date.now() && !pairing.approved) return null;
    const supplied = bearer(request);
    if (!supplied || await sha256(supplied) !== pairing.secretHash) return null;
    return pairing;
  }

  async authorizeBrowser(request) {
    const pairing = await this.storage.get("pairing");
    if (!pairing || !pairing.approved || !pairing.browserTokenHash) return null;
    const supplied = bearer(request);
    if (!supplied || await sha256(supplied) !== pairing.browserTokenHash) return null;
    return pairing;
  }

  async expireRequestIfNeeded(requestId) {
    const inflight = await this.storage.get("inflight");
    if (inflight?.envelope?.requestId === requestId && inflight.envelope.expiresAtMillis <= Date.now()) {
      await this.storeResult({
        requestId, action: inflight.envelope.action, status: "TIMED_OUT",
        detail: "কমান্ডের মেয়াদ শেষ হয়েছে; ফোন থেকে যাচাইযোগ্য ফলাফল পাওয়া যায়নি।",
        packageName: null, packageStateVerified: false, completedAt: Date.now()
      });
      await this.storage.delete("inflight");
      return;
    }
    const queue = (await this.storage.get("queue")) || [];
    const expired = queue.find(item => item.requestId === requestId && item.expiresAtMillis <= Date.now());
    if (expired) {
      await this.storage.put("queue", queue.filter(item => item.requestId !== requestId));
      await this.storeResult({
        requestId, action: expired.action, status: "TIMED_OUT",
        detail: "কমান্ড ফোনে পৌঁছানোর আগেই মেয়াদ শেষ হয়েছে।",
        packageName: null, packageStateVerified: false, completedAt: Date.now()
      });
    }
  }

  async storeResult(record) {
    await this.storage.put("result:" + record.requestId, record);
    const recent = (await this.storage.get("recentResults")) || [];
    const next = recent.filter(id => id !== record.requestId);
    next.push(record.requestId);
    while (next.length > 100) {
      const oldest = next.shift();
      await this.storage.delete("result:" + oldest);
    }
    await this.storage.put("recentResults", next);
  }
}
