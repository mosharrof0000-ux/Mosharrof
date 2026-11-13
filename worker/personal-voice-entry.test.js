import test from "node:test";
import assert from "node:assert/strict";
import worker from "../core/video-cutting/worker-entry.js";

test("Cloudflare Worker entrypoint routes personal voice health with app CORS", async () => {
  const origin = "https://mosharrof0000-ux.github.io";
  const response = await worker.fetch(
    new Request("https://worker.example/personal-voice/health", { headers: { Origin: origin } }),
    {}
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal((await response.json()).enabled, false);
});

test("Cloudflare Worker entrypoint protects personal voice profile routes", async () => {
  const origin = "https://mosharrof0000-ux.github.io";
  const response = await worker.fetch(
    new Request("https://worker.example/personal-voice/profiles", { headers: { Origin: origin } }),
    {}
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal((await response.json()).error, "registered_owner_authentication_required");
});

test("Cloudflare Worker rejects untrusted origins before personal voice requests", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/personal-voice/health", { headers: { Origin: "https://attacker.example" } }),
    {}
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "origin_not_allowed");
});
