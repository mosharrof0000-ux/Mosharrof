import { loadVideoCuttingWorker } from "./video-cutting-worker-loader.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../core/video-cutting/worker-proxy.js", import.meta.url), "utf8");
const { handleVideoCuttingProxy } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const worker = await loadVideoCuttingWorker();
const health = await worker.fetch(new Request("https://worker.test/video-cut/health", { headers: { Origin: "https://mosharrof0000-ux.github.io" } }), {});
assert.equal(health.status, 200);
assert.equal(health.headers.get("access-control-allow-origin"), "https://mosharrof0000-ux.github.io");
assert.equal((await health.json()).enabled, false);
assert.equal((await worker.fetch(new Request("https://worker.test/video-cut/health", { headers: { Origin: "https://attacker.example" } }), {})).status, 403);

const accessToken = "access-token-for-video-cutting-test-0001";
const apiToken = "scoped-backend-token-for-video-cutting-test-0001";
const jobId = "123e4567-e89b-42d3-a456-426614174000";
const env = { VIDEO_CUTTING_ENABLED: "true", VIDEO_CUTTING_API_URL: "https://video-api.example.test", VIDEO_CUTTING_API_TOKEN: apiToken, VIDEO_CUTTING_ACCESS_TOKEN: accessToken };
const auth = { authorization: "Bearer " + accessToken };
const originalFetch = globalThis.fetch;
const req = (path, init = {}) => new Request("https://worker.test/video-cut/" + path, init);
const mock = (payload, status = 200, headers = { "content-type": "application/json" }) => {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(payload instanceof Uint8Array ? payload : JSON.stringify(payload), { status, headers });
  };
};
let calls = [];

try {
  let response = await handleVideoCuttingProxy(req("health"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).enabled, false);
  response = await handleVideoCuttingProxy(req("upload", { method: "POST", headers: { ...auth, "content-type": "video/mp4", "x-filename": "a.mp4" }, body: "x" }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "video_cutting_not_configured");
  response = await handleVideoCuttingProxy(req("jobs/" + jobId), env);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "video_cutting_access_denied");
  response = await handleVideoCuttingProxy(req("jobs/not-a-uuid", { headers: auth }), env);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_job_id");
  response = await handleVideoCuttingProxy(req("upload", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: "{}" }), env);
  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "video_content_type_required");
  response = await handleVideoCuttingProxy(req("upload", { method: "POST", headers: { ...auth, "content-type": "video/mp4", "x-filename": "large.mp4", "content-length": String(40 * 1024 * 1024 + 1) }, body: "x" }), env);
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "video_upload_too_large");

  mock({ job: { id: jobId, status: "queued" }, bytes_received: 8 }, 202);
  response = await handleVideoCuttingProxy(req("upload", { method: "POST", headers: { ...auth, "content-type": "video/mp4", "x-filename": "synthetic.mp4" }, body: new Uint8Array([0,1,2,3,4,5,6,7]) }), env);
  assert.equal(response.status, 202);
  assert.equal((await response.json()).job.id, jobId);
  assert.equal(calls[0].url, "https://video-api.example.test/api/v1/uploads");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.get("authorization"), "Bearer " + apiToken);
  assert.ok(calls[0].init.body instanceof FormData);
  const uploadedFile = calls[0].init.body.get("file");
  assert.equal(uploadedFile.name, "synthetic.mp4");
  assert.equal(uploadedFile.type, "video/mp4");
  assert.deepEqual([...new Uint8Array(await uploadedFile.arrayBuffer())], [0,1,2,3,4,5,6,7]);

  calls = [];
  mock({ id: jobId, status: "completed", progress_percent: 100 });
  response = await handleVideoCuttingProxy(req("jobs/" + jobId, { headers: auth }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "completed");
  assert.equal(calls[0].url, "https://video-api.example.test/api/v1/jobs/" + jobId);
  assert.equal(calls[0].init.headers.get("authorization"), "Bearer " + apiToken);

  calls = [];
  mock(new Uint8Array([0,1,2,3]), 200, { "content-type": "video/mp4", "content-length": "4" });
  response = await handleVideoCuttingProxy(req("jobs/" + jobId + "/output", { headers: auth }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("content-length"), "4");
  assert.match(response.headers.get("content-disposition"), /mosharrof-edited\.mp4/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0,1,2,3]);
  assert.equal(calls[0].url, "https://video-api.example.test/api/v1/jobs/" + jobId + "/output");

  response = await handleVideoCuttingProxy(req("jobs/" + jobId, { headers: auth }), { ...env, VIDEO_CUTTING_API_URL: "http://video-api.example.test" });
  assert.equal(response.status, 503);
  console.log("VIDEO CUTTING PROXY CONTRACT: PASS");
} finally {
  globalThis.fetch = originalFetch;
}
