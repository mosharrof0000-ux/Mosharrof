# Mosharrof Visual QA Engine

Mosharrof can inspect its own rendered interface before promotion.

Flow:

1. Open the candidate URL in a real Chromium browser.
2. Capture mobile and desktop screenshots.
3. Run functional UI smoke tests.
4. Optionally send screenshots to the connected Gemini Vision reviewer.
5. Store screenshots and review JSON as CI artifacts.
6. A failed visual review blocks promotion.
7. Only the verified PR can reach protected \`main\`.
8. GitHub Pages deploys from \`main\`, followed by live health checking.

This is a QA/review system, not a direct permission to modify \`main\`.
