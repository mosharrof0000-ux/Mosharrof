# Organ Runtime

Per-organ scoped memory, contract-gated calls, health reporting, and bounded audit.

- Session memory is isolated by organ ID and returns defensive copies.
- Optional browser-local storage can retain non-secret, user-approved values on this device.
- Secret-like keys are rejected; payloads, values, and audit history are bounded.
- Cross-organ calls require a declared link and registered public API.
- No network, credential, filesystem, or deployment capability is provided.

This is logical isolation within one browser origin, not a security sandbox against arbitrary scripts running on that origin.
