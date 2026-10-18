#!/usr/bin/env bash
set -euo pipefail
node scripts/test_android_agent_memory_ui.mjs
node scripts/test_android_file_manager_ui.mjs
node scripts/test_android_agent_executor_recovery.mjs
node scripts/test_android_agent_file_command_router.mjs
