#!/usr/bin/env bash
set -euo pipefail

# Keep this entrypoint small to satisfy the unchanged file-growth gate.
source "$(dirname "${BASH_SOURCE[0]}")/lib/apk_webview_smoke_helpers.sh"
apk_webview_smoke_run
