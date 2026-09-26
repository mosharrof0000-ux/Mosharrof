# Mosharrof Autonomous System v1

The autonomous cycle runs every 6 hours and can also be triggered by a user request.

## Request
Use an issue or issue comment containing:
`/mosharrof <request>`

Example:
`/mosharrof স্ক্রিনশট বিশ্লেষণ ফিচার যোগ করো`

## Safety pipeline
Request/audit → isolated agent branch → allowlisted files → no deletion → tests → PR → required checks → controlled promotion → Pages deployment → live health check.

The autonomous agent cannot modify deployment/security workflows, CODEOWNERS, repository settings, or delete files.

The agent requires the repository secret `GEMINI_API_KEY`.
