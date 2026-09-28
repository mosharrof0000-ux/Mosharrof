# Mosharrof Autonomous Operation

## Component-conscious operation

Mosharrof treats each production component as a named system organ with four things: identity, responsibility, health checks, and a safety boundary. “চৈতন্য” here means operational awareness: the system can inspect whether a component exists, whether its contract is healthy, and whether a proposed change respects its boundary. It does not imply human consciousness.

The registry is maintained in `config/autonomous_operation.json`.

### Registered components

- **web-ui** — user-facing interface; protected by browser visual QA.
- **test-system** — regression and contract protection; protected by pytest.
- **autonomous-engine** — guarded reasoning/change orchestration; cannot delete or write main directly.
- **visual-qa** — mobile and desktop visual verification.
- **operation-config** — identity, boundaries, component registry, and health contracts.
- **documentation** — operating knowledge and audit trail.
- **ci-verification** — verification/deployment automation and protected promotion path.

## One canonical path

1. User instruction or scheduled maintenance cycle
2. Component health audit
3. Isolated implementation branch
4. Guarded code generation
5. Unit tests
6. Mobile and desktop browser QA
7. Pull request to protected main
8. Protected promotion
9. GitHub Pages deployment
10. Live HTTP health check
11. Evidence retained as workflow artifacts

## Safety boundary

The autonomous coding engine cannot delete files, repositories, branches, secrets, deployments, or user data. It cannot force-push, change workflow policy, or write main directly.

The live site is produced by the Pages deployment workflow only after a change reaches main.

## Visual gate

Every autonomous candidate is tested at 390x844 and 1440x900. The gate checks the header, drawer, message area, composer, message presence, fixed composer behavior, and overflow behavior.

## Component health rule

A component is not considered healthy merely because its file exists. Its declared health contract must be checked before an autonomous change is accepted. A failed component check stops promotion rather than being silently ignored.

## Promotion

The autonomous engine creates a verified PR and requests protected auto-merge. GitHub's required checks and main protection remain authoritative; the engine never pushes directly to main.

## Cleanup rule

Only the canonical autonomous pipeline is treated as production automation. Older experimental workflows are not relied upon for promotion.
