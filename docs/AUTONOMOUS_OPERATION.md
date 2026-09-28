# Mosharrof Autonomous Operation

## One canonical path

1. User instruction or scheduled maintenance cycle
2. Isolated implementation branch
3. Guarded code generation
4. Unit tests
5. Mobile and desktop browser QA
6. Pull request to protected main
7. Protected promotion
8. GitHub Pages deployment
9. Live HTTP health check
10. Evidence retained as workflow artifacts

## Safety boundary

The autonomous coding engine cannot delete files, repositories, branches, secrets, deployments, or user data. It cannot force-push, change workflow policy, or write main directly.

The live site is produced by the Pages deployment workflow only after a change reaches main.

## Visual gate

Every autonomous candidate is tested at 390x844 and 1440x900. The gate checks the header, drawer, message area, composer, message presence, fixed composer behavior, overflow behavior, and top/bottom fade elements.

## Promotion

The existing repository main protection remains authoritative. The autonomous engine creates a verified PR; it does not bypass protection.

## Cleanup rule

Only this workflow and this visual QA script are the canonical autonomous path. Older experimental branches and duplicate PRs are not production systems.

## Component awareness

Mosharrof maintains a registry of its operational components in `config/mosharrof_consciousness.json`. The awareness audit checks each registered component for identity, presence, readability and health before autonomous work proceeds. This is operational observability, not a claim of human-like consciousness.
