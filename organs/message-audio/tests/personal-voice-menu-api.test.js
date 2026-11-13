import test from "node:test";
import assert from "node:assert/strict";
import { apiRequest, cacheDefaultVoiceProfileId, element, getDefaultVoiceProfileId, resetDefaultVoiceProfileIdCache, statusText } from "../components/personal-voice-menu-api.js";

test("Read Aloud menu creates safe text-only UI elements", () => {
  const documentRef = { createElement(tag) { return { tag, textContent: "", className: "" }; } };
  const node = element(documentRef, "span", "<unsafe>", "pv-test");
  assert.equal(node.tag, "span");
  assert.equal(node.textContent, "<unsafe>");
  assert.equal(node.className, "pv-test");
});

test("owner API maps authentication errors to Bengali messages", () => {
  assert.match(statusText(new Error("registered_owner_authentication_required")), /Owner Registry/);
  assert.match(statusText(new Error("email_not_confirmed")), /ইমেইল/);
});

test("default voice profile cache avoids repeated profile lookups", async () => {
  cacheDefaultVoiceProfileId("profile-123");
  assert.equal(await getDefaultVoiceProfileId(), "profile-123");
});

test("API requests attach the owner JWT and disable caching", async () => {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.localStorage = {
    getItem(key) {
      if (key === "mosharrof_personal_voice_auth_v1") return JSON.stringify({ access_token: "owner-session-token-1234567890", expires_at: Math.floor(Date.now() / 1000) + 3600 });
      return null;
    },
    setItem() {}
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const result = await apiRequest("/readiness");
    assert.equal(result.ok, true);
    assert.equal(calls[0].options.headers.get("Authorization"), "Bearer owner-session-token-1234567890");
    assert.equal(calls[0].options.cache, "no-store");
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.fetch = previousFetch;
  }
});

test("default profile lookup uses the injected fetcher and is cached", async () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      if (key === "mosharrof_personal_voice_auth_v1") return JSON.stringify({ access_token: "owner-session-token-1234567890", expires_at: Math.floor(Date.now() / 1000) + 3600 });
      return null;
    },
    setItem() {}
  };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ profiles: [], default_profile_id: "profile-from-server" }), { status: 200 });
  };
  try {
    resetDefaultVoiceProfileIdCache();
    assert.equal(await getDefaultVoiceProfileId(fetcher, async () => "owner-token"), "profile-from-server");
    assert.equal(await getDefaultVoiceProfileId(fetcher, async () => "owner-token"), "profile-from-server");
    assert.equal(calls.length, 1);
  } finally {
    cacheDefaultVoiceProfileId(null);
    globalThis.localStorage = previousStorage;
  }
});
