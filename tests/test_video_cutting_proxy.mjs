import { loadWorker } from "./worker-loader.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker/video-cutting-proxy.js", import.meta.url), "utf8");
const proxy = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const { handleVideoCuttingProxy } = proxy;
const worker = await loadWorker();
const workerHealth = await worker.fetch(new Request("https://worker.test/video-cut/health", {
  headers: { Origin: "https://mosharrof0000-ux.github.io" }
}), {});
assert.equal(workerHealth.status, 200);
assert.equal(workerHealth.headers.get("access-control-allow-origin"), "https://mosharrof0000-ux.github.io");
assert.equal((await workerHealth.json()).enabled, false);
const deniedOrigin = await worker.fetch(new Request("https://worker.test/video-cut/health", {
  headers: { Origin: "https://attacker.example" }
}), {});
assert.equal(deniedOrigin.status, 403);
const accessToken = "access-token-for-video-cutting-test-0001";
const apiToken = "scoped-backend-token-for-video-cutting-test-0001";
const jobId = "123e4567-e89b-42d3-a456-426614174000";
const env = {
  VIDEO_CUTTING_ENABLED: "true",
  VIDEO_CUTTING_API_URL: "https://video-api.example.test",
  VIDEO_CUTTING_API_TOKEN: apiToken,
  VIDEO_CUTTING_ACCESS_TOKEN: accessToken
};
const originalFetch = globalThis.fetch;

try {
  const health = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/health"), {});
  assert.equal(health.status, 200);
  assert.equal((await health.json()).enabled, false);

  const disabled = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/upload", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=x", authorization: "Bearer " + accessToken },
    body: "--x--"
  }), {});
  assert.equal(disabled.status, 503);
  assert.equal((await disabled.json()).error, "video_cutting_not_configured");

  const denied = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/jobs/" + jobId), env);
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error, "video_cutting_access_denied");

  const badId = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/jobs/not-a-uuid", {
    headers: { authorization: "Bearer " + accessToken }
  }), env);
  assert.equal(badId.status, 400);
  assert.equal((await badId.json()).error, "invalid_job_id");

  const wrongType = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/upload", {
    method: "POST",
    headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
    body: "{}"
  }), env);
  assert.equal(wrongType.status, 415);
  assert.equal((await wrongType.json()).error, "multipart_video_upload_required");

  const tooLarge = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/upload", {
    method: "POST",
    headers: {
      authorization: "Bearer " + accessToken,
      "content-type": "multipart/form-data; boundary=x",
      "content-length": String(40 * 1024 * 1024 + 1)
    },
    body: "--x--"
  }), env);
  assert.equal(tooLarge.status, 413);
  assert.equal((await tooLarge.json()).error, "video_upload_too_large");

  let calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ job: { id: jobId, status: "queued" }, bytes_received: 8 }), {
      status: 202,
      headers: { "content-type": "application/json" }
    });
  };
  const form = new FormData();
  form.append("file", new Blob(["synthetic-video"]), "synthetic.mp4");
  const uploaded = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/upload", {
    method: "POST",
    headers: { authorization: "Bearer " + accessToken },
    body: form
  }), env);
  assert.equal(uploaded.status, 202);
  assert.equal((await uploaded.json()).job.id, jobId);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://video-api.example.test/api/v1/uploads");
  assert.equal(calls[0].init.headers.get("authorization"), "Bearer " + apiToken);
  assert.match(calls[0].init.headers.get("content-type"), /^multipart\/form-data; boundary=/i);
  assert.equal(calls[0].init.method, "POST");

  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: jobId, status: "completed", progress_percent: 100 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const status = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/jobs/" + jobId, {
    headers: { authorization: "Bearer " + accessToken }
  }), env);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).status, "completed");
  assert.equal(calls[0].url, "https://video-api.example.test/api/v1/jobs/" + jobId);
  assert.equal(calls[0].init.headers.get("authorization"), "Bearer " + apiToken);

  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(new Uint8Array([0, 1, 2, 3]), {
      status: 200,
      headers: { "content-type": "video/mp4" }
    });
  };
  const output = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/jobs/" + jobId + "/output", {
    headers: { authorization: "Bearer " + accessToken }
  }), env);
  assert.equal(output.status, 200);
  assert.equal(output.headers.get("content-type"), "video/mp4");
  assert.match(output.headers.get("content-disposition"), /mosharrof-edited\.mp4/);
  assert.deepEqual([...new Uint8Array(await output.arrayBuffer())], [0, 1, 2, 3]);
  assert.equal(calls[0].url, "https://video-api.example.test/api/v1/jobs/" + jobId + "/output");

  const unsafeUrl = await handleVideoCuttingProxy(new Request("https://worker.test/video-cut/jobs/" + jobId, {
    headers: { authorization: "Bearer " + accessToken }
  }), { ...env, VIDEO_CUTTING_API_URL: "http://video-api.example.test" });
  assert.equal(unsafeUrl.status, 503);

  console.log("VIDEO CUTTING PROXY CONTRACT: PASS");
} finally {
  globalThis.fetch = originalFetch;
}
