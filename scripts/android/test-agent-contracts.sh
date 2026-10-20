#!/usr/bin/env bash
set -euo pipefail
node scripts/test_device_control_contract.mjs
node scripts/test_android_settings_hub.mjs
node scripts/test_android_agent_planner.mjs
node scripts/test_android_agent_command_router.mjs
node scripts/test_android_agent_capabilities.mjs
node scripts/test_voice_tile_main_chat_contract.mjs
node scripts/test_new_chat_floating_contract.mjs
node scripts/test_android_accessibility_ui.mjs
node scripts/test_android_file_manager.mjs
node scripts/test_android_agent_task_planner.mjs
node scripts/test_android_agent_memory.mjs
node scripts/test_android_agent_recovery.mjs
node scripts/test_android_agent_executor.mjs
node scripts/test_android_accessibility_composer_contract.mjs
bash scripts/android/test-agent-ui-contracts.sh
python3 - <<'PY'
from pathlib import Path
source = Path("scripts/android/install-voice-overlay.sh").read_text(encoding="utf-8")
start = source.index("@Override public int onStartCommand(Intent intent, int flags, int startId)")
end = source.index("private void createChannel()", start)
handler = source[start:end]
assert handler.index("startForeground(NOTIFICATION_ID, notification());") < handler.index("String action = intent == null ? null : intent.getAction();"), "Foreground notification must be refreshed before action handling"
print("Foreground service restart contract: PASS")
PY
