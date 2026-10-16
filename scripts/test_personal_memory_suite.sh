#!/usr/bin/env bash
set -euo pipefail
node tests/test_personal_memory_engine.mjs
node --test tests/personal-memory-engine.test.mjs
node --check core/personal-memory-bridge.js
