# Parallel failure triage implementation

This branch adds a six-lane diagnostic workflow for failed Android APK real-chat checks. Each lane captures run logs and reports on one hypothesis family: artifact selection, emulator/ADB, WebView CDP, composer, backend response, and evidence retention. It is diagnostic-only: no lane edits source code, claims success, merges, or deploys. Every report links to the triggering run; the first confirmed fix must still pass the real end-to-end acceptance test before integration.
