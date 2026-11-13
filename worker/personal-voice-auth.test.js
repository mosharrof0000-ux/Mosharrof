import test from "node:test";
import assert from "node:assert/strict";
import { handlePersonalVoiceAuth } from "../organs/personal-voice/worker/auth.js";

test("owner login forwards credentials only to configured Supabase Auth", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl = "";
  let upstreamBody = null;
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url);
    upstreamBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ access_token: "session-access-token", refresh_token: "session-refresh-token", expires_in: 3600 }), { status: 200 });
  };
  try {
    const response = await handlePersonalVoiceAuth(
      new Request("https://worker.example/personal-voice/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "correct-horse-battery" })
      }),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(upstreamUrl, "https://project.supabase.co/auth/v1/token?grant_type=password");
    assert.deepEqual(upstreamBody, { email: "owner@example.com", password: "correct-horse-battery" });
    assert.equal(data.access_token, "session-access-token");
    assert.equal(JSON.stringify(data).includes("correct-horse-battery"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("owner login rejects invalid credentials before contacting Supabase", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("should_not_call"); };
  try {
    const response = await handlePersonalVoiceAuth(
      new Request("https://worker.example/personal-voice/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", password: "short" })
      }),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }
    );
    assert.equal(response.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unconfirmed owner email returns a safe verification status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error_code: "email_not_confirmed" }), { status: 400 });
  try {
    const response = await handlePersonalVoiceAuth(
      new Request("https://worker.example/personal-voice/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "correct-horse-battery" })
      }),
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "email_not_confirmed" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
