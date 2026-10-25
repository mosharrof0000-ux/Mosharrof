# Continuous automation: 24/7 intent, 15-minute cycles, and offline limits

## What this workflow can do
- GitHub Actions is configured to schedule a repository-wide read-only backlog/CI inspection every 15 minutes (cron `*/15 * * * *`) and can also be started manually.
- Each cycle records the UTC timestamp, checks GitHub API reachability with bounded retries, inventories open pull requests and their CI states, and uploads a report artifact retained for 14 days.
- Transient API failures are retried. If GitHub/network access is unavailable, the report must say UNAVAILABLE/UNVERIFIED; an empty response must never be reported as a green result.
- The next scheduled cycle can retry after connectivity returns. GitHub may delay scheduled jobs, so 15 minutes is the requested cadence, not a hard real-time guarantee.

## What it does not do
- This is monitoring and evidence collection, not an autonomous code-repair agent. It does not modify source, rerun arbitrary failed jobs, merge PRs, deploy, or claim that a physical Android phone was tested.
- The schedule is not active until this workflow is merged into the repository's default branch and an actual scheduled run is observed.
- A PR being open, mergeable, or having a green preview is not evidence that the workflow is running on the default branch.

## When there is no network
- A GitHub-hosted runner cannot execute a scheduled job if GitHub Actions itself is unavailable. If a runner starts but GitHub API/network access fails, the job records the outage and exits without destructive actions; a later cycle can retry.
- An Android device with no internet can only perform work that has been explicitly implemented locally and has local data/model/runtime available. It cannot call Gemini, Cloudflare Workers AI, Groq, GitHub APIs, or cloud services while offline.
- For a true offline-capable device engine, implement a local durable queue (SQLite), stable request IDs, retry/backoff with jitter, idempotency, a visible pending/synced/failed state, and replay when connectivity returns. Never report cloud work as completed until a server acknowledgement and real result are received.
- Local queueing and cloud 15-minute scheduling are separate mechanisms and need separate tests.

## Safety and acceptance gates
- Preserve main/live: feature branch -> checks -> evidence review -> PR approval/merge -> deployment verification.
- Never commit provider secrets to source, browser code, logs, or URLs.
- Treat provider health, Pages health, emulator QA, and physical-phone QA as separate evidence.
- Do not auto-merge or automatically alter permissions/secrets as a response to a failure.
- Acceptance for the scheduler requires: (1) PR checks green, (2) merge to default branch, (3) observed scheduled run(s), (4) uploaded report artifact, and (5) explicit outage simulation showing UNAVAILABLE/UNVERIFIED instead of false success.
