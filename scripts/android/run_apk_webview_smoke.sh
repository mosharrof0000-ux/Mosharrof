#!/usr/bin/env bash
set -euo pipefail

# Keep the workflow entrypoint small; the isolated helper owns install, chat QA,
# and diagnostic artifact collection under the repository's file-growth budget.
exec bash scripts/android/run_apk_webview_smoke_impl.sh
