# MOSHARROF Cloudflare Token Router Worker (isolated; privileged operations gated)

This Worker is isolated from the existing chat/TTS Worker. It never changes live chat routing.

## Operations
- `zone.read`: read a named zone (`Zone Read`).
- `worker.scripts.list`: list scripts in an account (`Workers Scripts Read`).
- `worker.secret.write`: write one named Worker secret (`Workers Scripts Write`).
- `worker.script.deploy`: deploy one JavaScript module to one script name (`Workers Scripts Write`).
- `token.list`: list user API tokens (`API Tokens Read`).
- `token.permission_groups.list`: list selectable user-token permission groups (`API Tokens Read`).
- `token.create`: create a scoped API token (`API Tokens Write`); accepts only allow policies with explicit permission-group IDs and resource IDs.
- `token.revoke`: revoke one explicitly named API token (`API Tokens Write`); privileged approval required.

All writes fail closed unless both server-side settings are present:
- `PRIVILEGED_OPERATIONS_ENABLED=true`
- `ROUTER_ADMIN_APPROVAL_TOKEN`: a separate high-entropy approval secret, never the router caller token.

Every privileged request also requires `x-router-admin-approval: <approval-secret>` in addition to the normal `Authorization: Bearer <ROUTER_ACCESS_TOKEN>`. The approval secret must never be sent through browser code, chat, logs, or source control. Keep privileged operations disabled until the approval secret, actual Cloudflare token permissions, resource scopes, and audit/rotation controls have been reviewed. The approval header is reusable; this implementation does not provide one-time approvals or a durable audit ledger, so do not expose privileged routes to untrusted callers.

## Token profiles
`CLOUDFLARE_TOKEN_PROFILES` is non-secret metadata. Each profile must accurately describe its actual Cloudflare token permissions and resource scopes. Bind each token value as a Worker secret named by `secret_binding`. Metadata does not grant permissions. The router chooses the narrowest matching enabled credential and never retries a denied operation with a broader token.

## Limits and safety
- No caller-supplied URL or API path.
- Strict operation-specific payload validation; no arbitrary proxy.
- Secret values and authorization headers are not returned in responses.
- Script source is limited to 300 KB; request body limit is 350 KB.
- Token creation accepts only allow policies with explicit 32-hex permission-group IDs and specific Cloudflare user/account/zone resource IDs; broad wildcard resources are rejected. Expiry is limited to 1–1440 minutes when supplied.
- Token revocation is available only through the approval-gated operation; token update/rotation is not exposed.
- `/health` and `/ready` return configuration presence/counts only.

## Deployment
The isolated workflow `.github/workflows/cloudflare-token-router-isolated-deploy.yml` deploys only this Worker. It does not configure routes, enable workers.dev, or change the chat/TTS Worker. It requires the staging GitHub Actions environment and an explicit manual `yes` input. Deployment does not configure Worker secrets or enable privileged operations.
