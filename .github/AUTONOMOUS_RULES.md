# Mosharrof Autonomous Rules

1. Never modify `main` directly from an autonomous coding job.
2. Every change starts from a fresh isolated branch.
3. Every proposed production change must use a pull request.
4. Automated verification is mandatory before promotion.
5. Visual QA is mandatory for UI changes.
6. Secrets must never be printed, committed, or made available to the coding agent as repository contents.
7. No destructive repository operations.
8. No force-push.
9. If any required check fails, stop and do not promote.
10. API/Gemini integration is a separate phase after this gate is validated.
