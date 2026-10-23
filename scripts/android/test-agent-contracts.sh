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
grep -q 'startForeground(NOTIFICATION_ID, notification());' scripts/android/install-voice-overlay.sh
