# Verified Core Lock

This directory defines the evidence-backed file protection policy for Mosharrof.

## Status

The initial manifest intentionally has no locked application files. A file is not marked
verified just because it exists or because a hash can be calculated. Add a file only
after its purpose, dependency edges, regression tests, and acceptance evidence have
been reviewed.

## Lock entry

Each entry in `core/verified-core/locked-files.json` must contain:
- `path`: repository-relative path to one regular file.
- `sha256`: lowercase SHA-256 of the exact UTF-8/binary file bytes.
- `evidence.verified_commit`: full commit SHA whose source and regressions were checked.
- `evidence.test_runs`: one or more verified GitHub Actions run URLs.
- `evidence.dependency_review`: concise description of reviewed callers/dependencies.
- `evidence.acceptance`: the acceptance checks that passed.
- `evidence.verified_at`: ISO date of the evidence review.

The CI gate fails when a locked file changes in a pull request or its current hash no
longer matches the recorded baseline. Intentional replacement requires a separate,
reviewed unlock/re-baseline change with fresh tests and evidence. Do not bundle a lock
manifest change with an application-file change to bypass review.

## Meaning of statuses

- `pilot-not-yet-locked`: the inventory/policy is present; no files are protected yet.
- `verified`: acceptance and regression checks have passed and evidence is recorded.
- `locked`: the file has an approved hash baseline and the CI gate enforces it.

A hash proves byte identity, not correctness. Dependencies, configuration, APIs, runtime
services, and the device environment still require tests. GitHub branch/ruleset settings
must also require the lock workflow to pass for enforcement on the protected branch.
