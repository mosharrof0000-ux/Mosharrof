# MOSHARROF Cloudflare Token Router Worker (isolated, read-only)

This Worker is deliberately separate from the existing chat/TTS Worker. It does not alter or replace the live chat API.

## Current capabilities

- `zone.read`: read one explicitly named Cloudflare zone.
- `worker.scripts.list`: list Workers scripts for one account.
- All operations are read-only. Arbitrary URLs, arbitrary API paths, caller-supplied permission names, request bodies to Cloudflare, and write operations are not supported.
- Every request requires the separate `ROUTER_ACCESS_TOKEN`.
- Existing Cloudflare tokens are selected from metadata in `CLOUDFLARE_TOKEN_PROFILES`; token values are Worker secrets, not profile JSON.
- A 401/403 from Cloudflare is not retried using another credential.

## Required server-side configuration

Configure these only in the intended Cloudflare Worker secret/variable settings; never commit secret values.

Secrets:
- `ROUTER_ACCESS_TOKEN`: long random bearer secret used by the caller to authenticate to this router.
- One secret per existing, verified Cloudflare token profile, e.g. `CF_ZONE_READ_TOKEN`.

Non-secret variable:
- `CLOUDFLARE_TOKEN_PROFILES`: JSON array, e.g.
  ```json
  [
    {
      "token_id": "zone-read-01",
      "secret_binding": "CF_ZONE_READ_TOKEN",
      "permissions": ["Zone Read"],
      "resource_scopes": ["/zones/REPLACE_WITH_ZONE_ID"],
      "enabled": true
    }
  ]
  ```

The profile metadata must match each token's real Cloudflare permissions and resources. The router's metadata is not a grant; Cloudflare remains authoritative. Do not enable any profile until it has been verified.

## Health and readiness

- `GET /health` reports service liveness and secret-free configuration diagnostics. It remains HTTP 200 while the Worker is running, even if the router is not configured.
- `GET /ready` returns HTTP 200 only when the router access secret is present and at least one enabled profile has valid metadata plus its bound provider secret. Otherwise it returns HTTP 503.
- Responses expose only booleans and counts; never secret values, profile names, or resource IDs.

## Deployment gate

The Wrangler file is isolated and has no route or account ID. The manually triggered workflow `.github/workflows/cloudflare-token-router-isolated-deploy.yml` deploys only this Worker and does not configure a route, enable `workers.dev`, or change the existing chat/TTS Worker.

Before running it, configure a GitHub Actions environment named `cloudflare-router-staging` with:
- Environment secret `CLOUDFLARE_API_TOKEN`, scoped only to deploy Workers scripts for the intended account.
- Environment variable `CLOUDFLARE_ACCOUNT_ID`, set to the intended Cloudflare account ID.

The workflow requires an explicit `yes` input and runs the Worker tests first. It does not configure `ROUTER_ACCESS_TOKEN`, any Cloudflare token profile secrets, or `CLOUDFLARE_TOKEN_PROFILES`; those must be configured separately in the deployed Worker settings before any private test. Until that setup is completed, the router is not ready for callers. No API token values are needed in chat. Do not add a production route or enable `workers.dev` as a shortcut.
