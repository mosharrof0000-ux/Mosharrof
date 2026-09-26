# Mosharrof Visual QA Engine

The browser opens both the candidate build and the current live URL, captures screenshots, and sends them to a connected vision model for comparison.

It checks preservation of existing UI, missing features, layout/overflow regressions, and requested additions. Screenshots and the report are retained as workflow artifacts.

Visual QA is a separate gate from functional tests. A low-confidence or failed visual assessment stops promotion.
