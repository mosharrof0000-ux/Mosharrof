# Mosharrof Visual QA

Every proposed UI change is rendered in Chromium at a 412x915 mobile viewport. The system opens the current Live URL and the proposed build, captures both screenshots, checks HTTP status, core UI regions, browser errors and screenshot dimensions, and stores Live/candidate/diff evidence as workflow artifacts. This visual check is intended to be a required promotion gate.
