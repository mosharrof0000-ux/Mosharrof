import test from "node:test";
import assert from "node:assert/strict";
import { handlePersonalVoiceRequest, PERSONAL_VOICE_LIMITS } from "../organs/personal-voice/worker/index.js";

test("personal voice health reports readiness flags without exposing secrets", async () => {
  const response = await handlePersonalVoiceRequest(
    new Request("https://worker.example/personal-voice/health"),
    { PERSONAL_VOICE_ENCRYPTION_KEY: "do-not-disclose" }
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.enabled, false);
  assert.equal(data.auth_configured, false);
  assert.equal(JSON.stringify(data).includes("do-not-disclose"), false);
});

test("personal voice endpoints reject missing user JWT", async () => {
  const response = await handlePersonalVoiceRequest(
    new Request("https://worker.example/personal-voice/profiles")
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "registered_owner_authentication_required");
});

test("non-personal-voice routes are not intercepted", async () => {
  const response = await handlePersonalVoiceRequest(new Request("https://worker.example/tts"));
  assert.equal(response, null);
});

test("upload and synthesis limits are bounded", () => {
  assert.equal(PERSONAL_VOICE_LIMITS.sampleBytes, 5 * 1024 * 1024);
  assert.equal(PERSONAL_VOICE_LIMITS.synthesisTextChars, 800);
  assert.equal(PERSONAL_VOICE_LIMITS.referenceTextChars, 500);
});

test("registered owner check is required before profile access", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: "123e4567-e89b-42d3-a456-426614174000" }), { status: 200 });
    if (target.endsWith("/rest/v1/rpc/asm_is_registered_owner")) return new Response("false", { status: 200 });
    throw new Error("unexpected_request");
  };
  try {
    const response = await handlePersonalVoiceRequest(
      new Request("https://worker.example/personal-voice/profiles", {
        headers: { Authorization: "Bearer 12345678901234567890123456789012" }
      }),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }
    );
    assert.equal(response.status, 401);
    assert.ok(calls.some(url => url.endsWith("/rest/v1/rpc/asm_is_registered_owner")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registered owner can read only the RLS-scoped profile API", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    calls.push(target);
    if (target.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: "123e4567-e89b-42d3-a456-426614174000" }), { status: 200 });
    if (target.endsWith("/rest/v1/rpc/asm_is_registered_owner")) return new Response("true", { status: 200 });
    if (target.includes("rest/v1/personal_voice_profiles?")) return new Response("[]", { status: 200 });
    if (target.includes("rest/v1/personal_voice_preferences?")) return new Response("[]", { status: 200 });
    throw new Error("unexpected_request:" + target);
  };
  try {
    const response = await handlePersonalVoiceRequest(
      new Request("https://worker.example/personal-voice/profiles", {
        headers: { Authorization: "Bearer 12345678901234567890123456789012" }
      }),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { profiles: [], default_profile_id: null });
    assert.equal(calls.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
