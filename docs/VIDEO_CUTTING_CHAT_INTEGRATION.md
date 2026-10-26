# Mosharrof chat-board video-cutting integration

This feature is a **disabled-by-default integration scaffold** for the separate `mosharrof-video-processing` service. It does not make video processing live by itself and must not be described as live until a real, authorized chat-to-export round trip succeeds.

## Routes

- `GET /video-cut/health` — returns only an enabled/configured boolean and safe size limits.
- `POST /video-cut/upload` — streams a small multipart upload to `POST /api/v1/uploads`.
- `GET /video-cut/jobs/{uuid}` — forwards job status to `GET /api/v1/jobs/{uuid}`.
- `GET /video-cut/jobs/{uuid}/output` — streams the MP4 response from `GET /api/v1/jobs/{uuid}/output`.

The proxy validates the job UUID, rejects non-HTTPS API origins, keeps the backend token on the Worker, checks a separate client access token, disables caching, and caps request bodies. It does not forward browser-supplied credentials to the backend.

## Configuration (Cloudflare Worker environment)

Use the Cloudflare Worker secret/variable settings; never commit values to this repository.

- `VIDEO_CUTTING_ENABLED` — variable; must remain `false` until deployment, authentication, rate-limit and storage reviews pass.
- `VIDEO_CUTTING_API_URL` — variable; HTTPS origin only, for example `https://video-api.example` (no path, query or credentials).
- `VIDEO_CUTTING_API_TOKEN` — secret; scoped backend token of at least 32 characters. It needs `video:upload`, `jobs:read`, and `exports:read` scopes for the routes above.
- `VIDEO_CUTTING_ACCESS_TOKEN` — separate secret of at least 32 characters. This is the user-entered client token for the chat UI; it is not the backend API token.

The UI keeps the client token in page memory only; it does not write it to localStorage/sessionStorage or chat history. The configured client token is a shared secret, not user identity. Do not enable this public route until a rate-limit/abuse-control review and the intended access policy are in place. Rotate any token that may have been exposed.

## First-stage limits

- Maximum video file: 39 MiB; maximum multipart request body: 40 MiB.
- Maximum browser-buffered export: 150 MiB.
- Upload is streamed through the Worker, not buffered as a full request body.
- Large 2–3 hour source uploads and large exports are **not supported by this first-stage browser proxy**. They need a direct-upload/download design that does not route multi-gigabyte bodies through a Cloudflare Worker or buffer large exports in browser memory.
- Only process user-owned or explicitly authorized media. No DRM/copyright bypass.

## Required verification before enabling

1. Deploy the video-processing API behind HTTPS with its private persistent state/upload/output volumes and a supervised worker.
2. Confirm `/readyz` and `/worker-readyz` separately; API readiness alone does not prove a media worker is running.
3. Add and verify rate limiting/abuse controls for the public Worker route.
4. Set the three secret/config values through the Cloudflare dashboard or approved secret mechanism, keeping `VIDEO_CUTTING_ENABLED=false` until the previous checks pass.
5. Test a short authorized MP4 from the actual Mosharrof chat UI: upload accepted, job ID returned, status progresses, MP4 downloads and FFprobe validates it.
6. Record exact deployment/config evidence and CI run links. Do not merge or deploy based only on mock tests.

## Current evidence boundary

The repository contract tests can verify routing, authentication gates, URL validation, size caps and mock upstream forwarding. They cannot prove that a real API endpoint/token exists, that Cloudflare has these variables, that the production worker is alive, or that a real chat-to-export request succeeds. Those remain **NOT TESTED** until the real deployment and credentials are configured safely.
