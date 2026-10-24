const CODE_TTL_MS = 5 * 60 * 1000;
const COMMAND_TTL_MS = 2 * 60 * 1000;
const MAX_QUEUE = 10;
const PACKAGE_NAME = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const DEVICE_ID = /^[A-Za-z0-9_-]{16,128}$/;
const ACTIONS = new Set(["INSTALL_APK", "SEARCH_PLAY_STORE", "UNINSTALL_APP"]);
const STATUSES = new Set(["REQUESTED", "AWAITING_USER_CONFIRMATION", "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNKNOWN"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function bearer(request) {
  const value = String(request.headers.get("authorization") || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
function randomHex(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value, b => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(value) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("invalid hex");
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function sign(secretHex, envelope) {
  const key = await crypto.subtle.importKey("raw", fromHex(secretHex), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const payload = [
    "mosharrof-device-command-v1", envelope.requestId, envelope.action,
    String(envelope.issuedAtMillis), String(envelope.expiresAtMillis),
    envelope.nonce, envelope.target
  ].join("\n");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
}
function validTarget(action, target) {
  if (typeof target !== "string" || target.length > 120 || /[\u0000-\u001f\u007f]/.test(target)) return false;
  if (action === "INSTALL_APK") return target === "";
  if (action === "SEARCH_PLAY_STORE") return target.trim().length > 0;
  if (action === "UNINSTALL_APP") return PACKAGE_NAME.test(target) || /^[\p{L}\p{N}][\p{L}\p{N} ._()+-]{0,79}$/u.test(target.trim());
  return false;
}
function terminal(status) {
  return ["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNKNOWN"].includes(status);
}

export class DeviceBridge {
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
    const ip = String(request.headers.get("CF-Connecting-IP") || "unknown");
    const rateKey = "pairStartRate:" + await sha256(ip);
    const rate = await this.storage.get(rateKey);
    const now = Date.now();
    const activeRate = rate && rate.resetAt > now ? rate : { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (activeRate.count >= 5) return json({ ok: false, error: "pair_start_rate_limited" }, 429);
    activeRate.count += 1;
    await this.storage.put(rateKey, activeRate);
    const existing = await this.storage.get("pairing");
    if (existing && existing.approved) {
      return json({ ok: false, error: "device_already_paired_revoke_first" }, 409);
    }
    if (existing && !existing.approved && existing.expiresAt > Date.now() && existing.deviceId !== deviceId) {
      return json({ ok: false, error: "pairing_already_pending" }, 409);
    }
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

  async poll(request) {
    const pairing = await this.authorizeDevice(request);
    if (!pairing || !pairing.approved) return json({ ok: false, error: "device_not_paired" }, 401);
    const inflight = await this.storage.get("inflight");
    if (inflight) {
      if (inflight.envelope.expiresAtMillis <= Date.now()) {
        await this.storeResult({
          requestId: inflight.envelope.requestId, action: inflight.envelope.action,
          status: "TIMED_OUT", detail: "ফোনে কাজের মেয়াদ শেষ হয়েছে; ফলাফল পাওয়া যায়নি।",
          packageName: null, packageStateVerified: false, completedAt: Date.now()
        });
        await this.storage.delete("inflight");
      } else {
        return json({ ok: true, command: null, busy: true });
      }
    }
    const queue = (await this.storage.get("queue")) || [];
    while (queue.length) {
      const envelope = queue.shift();
      await this.storage.put("queue", queue);
      if (envelope.expiresAtMillis <= Date.now()) {
        await this.storeResult({
          requestId: envelope.requestId, action: envelope.action, status: "TIMED_OUT",
          detail: "কমান্ড ফোনে পৌঁছানোর আগেই মেয়াদ শেষ হয়েছে।",
          packageName: null, packageStateVerified: false, completedAt: Date.now()
        });
        continue;
      }
      await this.storage.put("inflight", { envelope, deliveredAt: Date.now() });
      return json({ ok: true, command: envelope, busy: false });
    }
    return json({ ok: true, command: null, busy: false });
  }

  async createCommand(request) {
    const pairing = await this.authorizeBrowser(request);
    if (!pairing || !pairing.approved) return json({ ok: false, error: "browser_not_authorized" }, 401);
    const body = await request.json();
    const action = String(body.action || "");
    const target = String(body.target || "");
    if (!ACTIONS.has(action) || !validTarget(action, target)) {
      return json({ ok: false, error: "unsupported_or_malformed_action" }, 400);
    }
    const queue = (await this.storage.get("queue")) || [];
    if (queue.length >= MAX_QUEUE) return json({ ok: false, error: "device_queue_full" }, 429);
    const now = Date.now();
    const envelope = {
      requestId: randomHex(16), action, issuedAtMillis: now,
      expiresAtMillis: now + COMMAND_TTL_MS, nonce: randomHex(16), target
    };
    envelope.signatureHex = await sign(pairing.deviceSecret, envelope);
    queue.push(envelope);
    await this.storage.put("queue", queue);
    await this.storage.put("result:" + envelope.requestId, {
      requestId: envelope.requestId, action, status: "REQUESTED",
      detail: "কমান্ড নিরাপদ ফোন-ইনবক্সে অপেক্ষা করছে।", packageName: null,
      packageStateVerified: false, updatedAt: now
    });
    return json({ ok: true, requestId: envelope.requestId, status: "REQUESTED", expiresAtMillis: envelope.expiresAtMillis }, 202);
  }

  async submitResult(request) {
    const pairing = await this.authorizeDevice(request);
    if (!pairing || !pairing.approved) return json({ ok: false, error: "device_not_authorized" }, 401);
    const body = await request.json();
    const status = String(body.status || "");
    const prior = typeof body.requestId === "string" ? await this.storage.get("result:" + body.requestId) : null;
    const packageName = body.packageName == null ? null : String(body.packageName);
    const packageStateVerified = body.packageStateVerified === true;
    const priorTerminal = prior && (terminal(prior.status) ||
      (prior.status === "AWAITING_USER_CONFIRMATION" && prior.action === "SEARCH_PLAY_STORE"));
    if (prior && prior.requestId === body.requestId && prior.action === body.action &&
        prior.status === status && prior.detail === String(body.detail || "") &&
        prior.packageName === packageName && prior.packageStateVerified === packageStateVerified) {
      return json({ ok: true, accepted: true, terminal: !!priorTerminal });
    }
    const inflight = await this.storage.get("inflight");
    if (!inflight || body.requestId !== inflight.envelope.requestId || body.action !== inflight.envelope.action) {
      return json({ ok: false, error: "request_id_mismatch" }, 409);
    }
    const detail = String(body.detail || "");
    if (!STATUSES.has(status) || detail.length > 500 ||
        (packageName !== null && !PACKAGE_NAME.test(packageName)) ||
        (status === "SUCCEEDED" && (!packageStateVerified || body.action === "SEARCH_PLAY_STORE" || !packageName))) {
      return json({ ok: false, error: "invalid_result" }, 400);
    }
    const record = {
      requestId: body.requestId, action: body.action, status,
      detail, packageName, packageStateVerified, updatedAt: Date.now()
    };
    await this.storeResult(record);
    const isTerminal = terminal(status) ||
      (status === "AWAITING_USER_CONFIRMATION" && body.action === "SEARCH_PLAY_STORE");
    if (isTerminal) await this.storage.delete("inflight");
    else await this.storage.put("inflight", { ...inflight, lastStatus: status, updatedAt: Date.now() });
    return json({ ok: true, accepted: true, terminal: isTerminal });
  }

  async getResult(request, url) {
    const pairing = await this.authorizeBrowser(request);
    if (!pairing || !pairing.approved) return json({ ok: false, error: "browser_not_authorized" }, 401);
    const requestId = String(url.searchParams.get("requestId") || "");
    if (!/^[0-9a-f]{32}$/.test(requestId)) return json({ ok: false, error: "invalid_request_id" }, 400);
    await this.expireRequestIfNeeded(requestId);
    const result = await this.storage.get("result:" + requestId);
    if (result) return json({ ok: true, result });
    const inflight = await this.storage.get("inflight");
    if (inflight?.envelope?.requestId === requestId) {
      return json({ ok: true, result: {
        requestId, action: inflight.envelope.action, status: inflight.lastStatus || "REQUESTED",
        detail: "ফোনের ফলাফলের অপেক্ষায়।", packageName: null, packageStateVerified: false
      }});
    }
    const queue = (await this.storage.get("queue")) || [];
    if (queue.some(item => item.requestId === requestId)) {
      return json({ ok: true, result: { requestId, status: "REQUESTED", detail: "কমান্ড কিউতে আছে।", packageStateVerified: false }});
    }
    return json({ ok: false, error: "request_not_found" }, 404);
  }

  async revoke(request) {
    const pairing = await this.authorizeBrowser(request);
    if (!pairing || !pairing.approved) return json({ ok: false, error: "browser_not_authorized" }, 401);
    await this.storage.deleteAll();
    return json({ ok: true, revoked: true });
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
