# Recovery checkpoints

## One-click recovery

Use **Actions → One-Click Recovery Checkpoint → Run workflow** on the `main` branch.

- Default checkpoint: PR #420 merge commit `c896d37a619282306dabea4a9b5da6e6f1c12965`.
- Enter the reason and type exactly `RESTORE`.
- The workflow creates a recovery branch and pull request. It never force-pushes or writes directly to `main`.
- Review the complete diff and wait for the repository's required CI checks before merging. Restoring a full repository tree can remove changes introduced after the chosen checkpoint.

## One-time setup

Create a fine-grained GitHub token restricted to this repository with **Contents: Read and write** and **Pull requests: Read and write**, then add it under **Settings → Secrets and variables → Actions** using the exact secret name `MOSHARROF_RECOVERY_TOKEN`. The workflow reads this exact name. This token is needed so the recovery PR can trigger the normal CI workflows; PRs created using the built-in `GITHUB_TOKEN` do not reliably trigger those workflows.

## Safe recovery procedure

1. Confirm the `MOSHARROF_RECOVERY_TOKEN` secret exists; never print or paste its value.
2. Open the workflow from the `main` branch and leave the checkpoint at the default PR #420 merge commit unless a different checkpoint has been verified.
3. Enter a reason, for example: `Restore known-good PR #420 because current main is unstable`.
4. Type exactly `RESTORE` only when ready to request a full-tree recovery.
5. Wait for the generated recovery PR. Inspect the entire diff, especially deletions and configuration files, and require CI checks to pass before merging.
6. Verify the deployed app and key features after merge. A green CI run alone does not prove live behavior is healthy.

## Save a new checkpoint

After a release has passed CI and has been manually verified on the live site/app, record its immutable merge commit SHA and describe what was verified. Prefer a full commit SHA or protected tag rather than a moving branch name. Do not label a checkpoint "known-good" based only on CI green; include real-device/live checks where applicable.
