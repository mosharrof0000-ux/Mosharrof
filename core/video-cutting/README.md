# Video cutting integration module

This module is the isolated source of the first Mosharrof chat-board video-cutting integration.

- `ui.js`: composer tool, small-file upload, job polling and status panel.
- `download.js`: bounded MP4 download helper.
- `styles.css`: component styles.
- `loader.js`: loads the UI assets into the prepared Pages artifact.
- `worker-proxy.js`: disabled-by-default, scoped-token proxy for upload/status/export.
- `worker-entry.js`: wraps the existing chat Worker without changing its legacy source.

The Pages preparation script copies the browser assets into `web/video-cutting/`; Wrangler uses `worker-entry.js` as the Worker entrypoint. Keep production configuration disabled until rate-limit/abuse controls, HTTPS API deployment, persistent storage, and real authorized end-to-end tests are verified. This first stage is limited to 39 MiB uploads and 150 MiB browser-buffered exports.
