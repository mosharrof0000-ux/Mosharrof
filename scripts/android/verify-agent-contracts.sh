#!/usr/bin/env bash
set -euo pipefail
node scripts/test_android_agent_planner.mjs
node scripts/test_android_agent_task_planner.mjs
node scripts/test_android_agent_capabilities.mjs
node scripts/test_android_agent_executor.mjs
node scripts/test_android_agent_recovery.mjs
node scripts/test_android_agent_memory.mjs
node scripts/test_android_accessibility_composer_contract.mjs
node scripts/test_android_accessibility_ui.mjs
node scripts/test_android_file_manager.mjs
echo "Android agent contract suite: PASS"
