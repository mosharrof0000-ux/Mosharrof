# MOSHARROF Repository Operations Map

Last reviewed: 2026-09-30

## Canonical structure

### Web / live UI
- Source: `web/index.html`
- Live: `https://mosharrof0000-ux.github.io/Mosharrof/`
- Canonical deployment workflow: `.github/workflows/deploy-pages.yml`

### Gemini / screenshot Worker
- Source: `worker/screenshot-analysis.js`
- Config: `worker/wrangler.toml`
- Canonical deployment workflow: `.github/workflows/deploy-screenshot-worker.yml`
- Health endpoint: `/health`

### Pull-request promotion gate
- Canonical gate: `.github/workflows/verification-gate.yml`
- Main must remain protected.
- Changes should be made on a branch, verified, reviewed, then promoted.

### Tests
- Canonical project test command: `python3 -m pytest -q`
- Test suite is run by the active promotion/deployment workflows rather than by multiple duplicate workflows.

### Visual verification
- Canonical PR visual gate: `.github/workflows/verification-gate.yml`
- Scheduled/on-demand visual inspection: `.github/workflows/mosharrof-visual-qa.yml`

### Autonomous work
- Autonomous implementation workflow: `.github/workflows/mosharrof-autonomous.yml`
- Read-only health/audit workflow: `.github/workflows/autonomous-scheduler.yml`
- Command intake boundary: `.github/workflows/autonomous-command-intake.yml`

## Change discipline

1. Never edit `main` directly for feature/fix work.
2. Create an isolated branch.
3. Run tests and verification.
4. Open a PR.
5. Promote only after required checks are green.
6. Keep deployment, verification, and autonomous permissions separate.
7. Do not store API keys in source files.

## Retired duplicate workflows

The following legacy/duplicate workflows were removed from the active tree because their responsibilities are covered by the canonical workflows above:
- `pages.yml`
- `test.yml`
- `test-and-deploy.yml`
- `test_runner.yml`
- `ci.yml`
- `visual-qa.yml`

This file is the first place to check when adding or changing automation.
