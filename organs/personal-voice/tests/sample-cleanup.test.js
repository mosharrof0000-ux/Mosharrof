import test from "node:test";
import assert from "node:assert/strict";
import { clearPreviousSample, removeProfileSamples } from "../worker/sample-cleanup.js";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };

test("replaced sample cleanup deletes the old object and clears its database pointer", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null });
    return new Response(null, { status: options.method === "DELETE" ? 200 : 204 });
  };
  try {
    const result = await clearPreviousSample(env, "owner-token", "owner-id", {
      id: "profile-id", previous_sample_object_key: "owner-id/profile-id/old.enc"
    });
    assert.equal(result, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[1].method, "PATCH");
    assert.equal(calls[1].body.previous_sample_object_key, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed previous sample cleanup remains retryable and keeps its pointer", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(options.method);
    return new Response("storage unavailable", { status: 503 });
  };
  try {
    const result = await clearPreviousSample(env, "owner-token", "owner-id", {
      id: "profile-id", previous_sample_object_key: "owner-id/profile-id/old.enc"
    });
    assert.equal(result, false);
    assert.deepEqual(calls, ["DELETE"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("profile deletion attempts to remove both active and previous sample objects", async () => {
  const originalFetch = globalThis.fetch;
  const keys = [];
  globalThis.fetch = async (url, options) => {
    if (options.method === "DELETE") keys.push(JSON.parse(options.body).prefixes[0]);
    return new Response(null, { status: 200 });
  };
  try {
    const result = await removeProfileSamples(env, "owner-token", {
      sample_object_key: "owner-id/profile-id/new.enc",
      previous_sample_object_key: "owner-id/profile-id/old.enc"
    });
    assert.equal(result, true);
    assert.deepEqual(keys.sort(), ["owner-id/profile-id/new.enc", "owner-id/profile-id/old.enc"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
