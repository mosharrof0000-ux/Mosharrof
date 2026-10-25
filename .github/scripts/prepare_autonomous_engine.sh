#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  echo "AI provider configured: Gemini"
elif [[ -n "${GROQ_API_KEY:-}" ]]; then
  echo "AI provider configured: Groq"
elif [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  echo "AI provider configured: OpenRouter"
else
  echo "::error::No AI provider credentials configured. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY to repository Actions secrets; values are never printed."
  exit 1
fi

pip install -r requirements.txt
npm init -y
npm install --no-save playwright
npx playwright install --with-deps chromium
