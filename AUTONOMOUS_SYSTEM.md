# Mosharrof Autonomous Development System

## Operating model

Mosharrof uses an isolated-first development pipeline:

User request / scheduled audit
→ isolated agent workspace
→ automated verification
→ pull request
→ required checks
→ controlled promotion
→ GitHub Pages deployment
→ live health check.

## Main/Live boundary

- Agents must never write directly to `main`.
- Autonomous work must use a temporary/feature branch.
- Production deployment is sourced only from `main`.
- Destructive repository/project operations are forbidden to the autonomous agent.
- Failed verification must stop promotion.
- A failed live health check must not be treated as a successful release.

## Scheduled autonomy

The autonomous scheduler runs every six hours. It performs non-destructive checks and may create a maintenance PR when the configured agent credentials are available.

The scheduler is intentionally conservative: it does not deploy directly. Promotion occurs only through the repository's verified PR path.

## User-directed autonomy

A future/connected Mosharrof agent can accept a natural-language task such as:

> "স্ক্রিনশট বিশ্লেষণের ফিচার যোগ করো"

The agent should convert that request into a scoped change, implement it in isolation, run tests, and submit it for the same verification/promotion pipeline.

## Required secrets for full agent execution

The repository may provide these through GitHub Actions Secrets:

- `GEMINI_API_KEY`
- `AGENT_ACCESS_TOKEN` (if a separate restricted token is used)

Never commit secret values into the repository.

## Safety invariant

No autonomous workflow is allowed to delete the repository, delete the production branch, force-push production, or bypass the verification gate.
