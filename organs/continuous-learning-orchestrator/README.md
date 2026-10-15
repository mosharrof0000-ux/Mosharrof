# Continuous Learning Orchestrator

## Purpose
Provide a bounded, repeatable foundation for MOSHARROF AI to discover knowledge gaps, record source-backed evidence, prioritize blockers, and propose improvements over time.

## What is implemented
- A cycle planner with approved learning domains and bounded evidence/gap/proposal counts.
- HTTPS-only source URL validation; embedded URL credentials and non-HTTPS schemes are rejected.
- Evidence metadata for source title, summary, domain, publication/retrieval date, and an explicit reliability label.
- Gap records with impact, evidence references, blockers, and next steps.
- Improvement proposals that never authorize Live mutation, secret access, unrestricted external access, or automatic deployment.
- A policy declaration requiring a scheduler and allowlisted source connector before real background research can operate.

## What is not yet implemented
This is a policy/planning library, not a running background worker. It does not fetch websites, call ChatGPT/Gemini/Grok APIs, schedule itself, persist a database, execute code, create branches, or deploy changes. Those capabilities must be added as separately permissioned adapters and verified in CI. No provider keys are embedded in source.

## Safe learning loop
1. A scheduler creates a bounded cycle from approved domains.
2. An allowlisted connector fetches public sources within rate, time, and storage limits.
3. Evidence is recorded with provenance and freshness metadata.
4. The evaluator marks uncertainty, contradictions, and knowledge gaps.
5. The planner creates a proposal with expected benefit, risk, cost, tests, and rollback plan.
6. The change is isolated in a feature branch and tested in a sandbox.
7. Security and required checks must pass; a user-approved PR is required before any release.
8. A post-change health check records outcomes and updates the next cycle.

## Guardrails
- No mind-reading or certainty claims about unspoken user intent.
- No inference or storage of sensitive traits.
- No unrestricted internet crawling, no credentials embedded in URLs, no paid provider calls without consent.
- No self-modifying Live, permission escalation, secret reading, cross-organ imports, or autonomous merging.
- When the system cannot verify a claim, it must label it unknown and create a research gap instead of fabricating completion.
- The learning cycle must be bounded and resumable, with rate limits, a stop switch, audit records, and retention controls before background deployment.
