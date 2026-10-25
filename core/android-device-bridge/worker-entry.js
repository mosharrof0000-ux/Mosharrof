import { DeviceBridgeBase, json, randomHex, sign, validTarget, terminal, ACTIONS, STATUSES, PACKAGE_NAME, MAX_QUEUE, COMMAND_TTL_MS } from "./worker-base.js";
export class DeviceBridge extends DeviceBridgeBase {
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
    const action = typeof body.action === "string" ? body.action : "";
    const target = body.target == null ? "" : (typeof body.target === "string" ? body.target : null);
    if (!ACTIONS.has(action) || target === null || !validTarget(action, target)) {
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
    if (prior && prior.requestId === body.requestId && prior.action === body.action && priorTerminal) {
      // The first server terminal result is authoritative; late callbacks cannot rewrite it.
      return json({ ok: true, accepted: true, terminal: true, ignored: prior.status !== status });
    }
    if (prior && prior.requestId === body.requestId && prior.action === body.action &&
        prior.status === status && prior.detail === String(body.detail || "") &&
        prior.packageName === packageName && prior.packageStateVerified === packageStateVerified) {
      return json({ ok: true, accepted: true, terminal: false });
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
