# Mosharrof Visual QA Engine

Every candidate build can be opened in Chromium and captured at mobile and desktop sizes before promotion.

Evidence includes:
- mobile screenshot
- desktop screenshot
- required UI/safe-area invariants

The next review layer can send these images to a vision-capable connected model to compare the candidate with the previous stable build and detect additions, removals, overlap, clipping, spacing changes, and regressions. A visual failure should block promotion.
