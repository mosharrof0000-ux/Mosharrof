# Mosharrof Visual Inspection Engine

Before promotion, Mosharrof renders the proposed UI in an isolated Chromium browser, captures screenshots, and runs deterministic layout checks.

Code -> isolated browser -> screenshot -> layout checks -> report -> PR verification -> promotion.

The screenshot artifact is retained with the workflow run. It cannot modify main or live directly.

A future AI visual-review step can consume the screenshot and compare it with an approved baseline for missing controls, added controls, clipping, overlap, overflow, and major layout regressions.
