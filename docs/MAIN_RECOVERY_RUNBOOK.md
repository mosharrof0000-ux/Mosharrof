# MOSHARROF Main Recovery Runbook

## Safety promise

The recovery checkpoint workflow is additive. It does not reset or force-push `main`, change Cloudflare configuration, or deploy the live app. A recovery point is not a guarantee that a broken app will auto-repair itself; it preserves a known commit so recovery can be reviewed and performed safely.

## Automatic checkpoints

Workflow: `.github/workflows/main-recovery-checkpoint.yml`

- Runs after every push to `main`, and can also be run manually from GitHub Actions.
- Creates a uniquely named annotated Git tag `recovery-main-...` pointing to the exact pushed commit (or current main when manually dispatched).
- Builds and verifies a full-history Git bundle, then uploads it as a GitHub Actions artifact for 90 days.
- The workflow needs repository Actions permissions that allow its `GITHUB_TOKEN` to write contents/tags. If GitHub repository settings block this, the run will fail visibly and no checkpoint should be assumed to exist.

## If the live app appears broken

1. Do not force-push, delete tags, or immediately overwrite `main`.
2. Open Actions → **MOSHARROF Main Recovery Checkpoint** and verify the most recent run completed successfully. Record its tag and commit SHA from the run summary.
3. Compare the current main commit against the last known-good checkpoint and identify the specific regression. Keep logs and the failing run URL.
4. Prefer a fix or a revert in a separate recovery branch and pull request. Run tests and verify Pages health before merging.
5. Only restore a prior full snapshot when the owner has identified the exact intended commit and reviewed the consequences. A commit rollback may remove newer legitimate changes; database, external secrets, Cloudflare resources, and uploaded user data are not restored by Git alone.

## Restore bundle

Download the `mosharrof-main-recovery-<commit SHA>` artifact from the successful checkpoint run before its 90-day expiry. Keep a separate owner-controlled copy if long-term retention is required. The artifact is a Git bundle; it can be inspected in a separate local clone with `git bundle verify` and `git bundle list-heads`. Do not push recovered history directly to `main` without review.

## Secret and service recovery limits

- Git history and bundles must never be used to store API tokens, passwords, or other secrets.
- Cloudflare Worker secrets, account-level settings, DNS/routes, and GitHub Actions secrets are not backed up by this workflow.
- Do not share recovery tokens or API tokens in chat.
- A successful checkpoint run is the evidence that a checkpoint exists; merely having this workflow file does not prove a backup has run.
