# Mosharrof Visual QA Engine

Before an autonomous change can reach Live, the engine can render the proposed \`web/\` build on a real Chromium mobile viewport and capture a screenshot. It also opens the current Mosharrof Live URL and captures the same viewport.

Gemini vision compares both images and checks:
- missing or damaged existing UI
- clipping/overlap
- header/navigation/composer regressions
- safe-area problems
- whether the requested feature is visibly present

A failed visual review blocks promotion.

This is complementary to code/unit tests; it does not replace them.
