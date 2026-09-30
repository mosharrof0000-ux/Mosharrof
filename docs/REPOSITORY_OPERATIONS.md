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
- **Canonical implementation pipeline:** `.github/workflows/mosharrof-autonomous.yml`
  - Uses the guarded autonomous engine.
  - Runs isolated task implementation, tests/visual QA, and ends at a PR/promotion boundary.
- **Canonical read-only audit:** `.github/workflows/autonomous-scheduler.yml`
  - Six-hour repository audit; records the result as an issue.
- **Command intake boundary:** `.github/workflows/autonomous-command-intake.yml`
  - Validates labeled autonomous requests and blocks destructive/bypass requests.

#### Autonomous workflows under consolidation
These files remain present while their historical roles are reviewed. They must not be treated as additional canonical automation:
- `.github/workflows/autonomous-health.yml` — overlaps the read-only audit and currently adds no unique promotion capability.
- `.github/workflows/autonomous-cycle.yml` — older write-capable cycle using `.github/scripts/mosharrof_agent.py`; separate from the canonical guarded pipeline.
- `.github/workflows/mosharrof-autonomous-engine.yml` — older direct runner for `scripts/mosharrof_autonomous_engine.py`; the canonical pipeline wraps this engine with the safer isolated/App-token path.
- `.github/workflows/mosharrof-autonomous-6h.yml` — older agent path using `scripts/autonomous_agent.py` and `AGENT_ACCESS_TOKEN`.
- `.github/workflows/ai-agent.yml` — legacy GitHub-App authentication workflow; its authentication dependency is being replaced separately.

**Rule:** only `mosharrof-autonomous.yml` is the canonical autonomous implementation path. Do not add another scheduled autonomous writer without first updating this map and retiring/consolidating the older path.

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
