# Mosharrof Visual QA

Every candidate is visually tested, not only code-tested.

The gate opens the current Live URL, opens the candidate build in isolation, captures mobile screenshots, checks required UI regions, creates a pixel-diff artifact, and blocks a major visual regression.

It runs on pull requests and every 6 hours. A connected multimodal AI can later review the same screenshot evidence, but its result is advisory; deterministic tests and protected-main rules remain authoritative.
