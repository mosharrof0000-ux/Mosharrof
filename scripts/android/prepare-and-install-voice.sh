#!/usr/bin/env bash
set -euo pipefail

# Keep each generator under the repository's per-file budget.
bash scripts/android/prepare-wrapper.sh
bash scripts/android/install-voice-overlay.sh
bash scripts/android/install-voice-command-activity.sh
bash scripts/android/install-voice-tile.sh
bash scripts/android/install-main-activity.sh
bash scripts/android/install-agent-accessibility.sh