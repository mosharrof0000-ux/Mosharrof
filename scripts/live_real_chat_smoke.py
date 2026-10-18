#!/usr/bin/env python3
"""Opt-in real chat smoke test for the published MOSHARROF AI Pages UI.

Uses a disposable Playwright browser and one synthetic prompt against the real
configured chat backend. No provider credentials are read or logged. This may
consume one unit of provider quota and is never used by scheduled QA.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
parser.add_argument("--output-dir", default="artifacts/live-screen-inspector")
parser.add_argument("--timeout-ms", type=int, default=90000)
args = parser.parse_args()
out = Path(args.output_dir)
out.mkdir(parents=True, exist_ok=True)

prompt = "লাইভ চ্যাট সংযোগ পরীক্ষা। অনুগ্রহ করে শুধু লিখুন: লাইভ চ্যাট পরীক্ষা সফল।"
report = {
    "agent": "MOSHARROF real live chat smoke test",
    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    "target_url": args.url,
    "mode": "real_backend_one_synthetic_prompt",
    "policy": {
        "synthetic_prompt_only": True,
        "real_provider_request": True,
        "may_consume_provider_quota": True,
        "browser_profile": "fresh disposable Playwright context",
        "secrets_logged": False,
    },
    "checks": [],
    "errors": [],
}

def record(name: str, passed: bool, detail: str = "") -> None:
    report["checks"].append({"name": name, "passed": bool(passed), "detail": detail})
    if not passed:
        report["errors"].append({"check": name, "detail": detail})

async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 412, "height": 915},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
            permissions=[],
        )
        page = await context.new_page()
        page.set_default_timeout(min(args.timeout_ms, 15000))
        page.on("pageerror", lambda exc: report["errors"].append(
            {"type": "pageerror", "detail": str(exc)[:500]}))
        response = await page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        record("live_page_loaded", bool(response and response.status < 400),
               f"HTTP {response.status if response else 'no response'}")
        await page.wait_for_selector("#input", state="visible", timeout=20000)
        await page.wait_for_selector("#sendBtn", state="visible", timeout=10000)
        await page.screenshot(path=str(out / "real-chat-before.png"), full_page=True)

        baseline = await page.locator("#messages .message.ai:not(.typing)").count()
        await page.locator("#input").fill(prompt)
        await page.locator("#sendBtn").click()
        record("real_chat_prompt_submitted", True, "One synthetic Bengali prompt submitted through the visible UI")
        answer = ""

        try:
            await page.wait_for_function(
                """baseline => {
                  const send = document.querySelector('#sendBtn');
                  const typing = document.querySelector('#typing');
                  const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
                  const last = nodes[nodes.length - 1];
                  const body = last && last.querySelector('.rich-content');
                  return !!send && !send.disabled && !typing &&
                    nodes.length > baseline && !!body && body.innerText.trim().length > 0;
                }""",
                arg=baseline,
                timeout=args.timeout_ms,
            )
            nodes = page.locator("#messages .message.ai:not(.typing)")
            answer = (await nodes.last.locator(".rich-content").inner_text()).strip()
            lower = answer.lower()
            failed_phrases = [
                "এই মুহূর্তে gemini সংযোগে সমস্যা",
                "you exceeded your current quota",
                "quota exceeded",
                "failed to fetch",
                "network error",
                "অনুরোধটি ব্যর্থ",
                "সংযোগে সমস্যা",
            ]
            backend_error = any(phrase in lower for phrase in failed_phrases)
            looks_mocked = "inspector mock response" in lower or "playwright-safe-test" in lower
            success = bool(answer) and not backend_error and not looks_mocked
            record("real_backend_returned_non_mock_answer", success,
                   f"response_chars={len(answer)}; mock_marker={looks_mocked}; backend_error_marker={backend_error}")
            # Preserve the test evidence while avoiding unnecessary transcript dumps in logs.
            await page.screenshot(path=str(out / "real-chat-after.png"), full_page=True)
            report["response_preview"] = answer[:240]
            report["response_provider"] = await nodes.last.get_attribute("data-provider")
        except Exception as exc:
            record("real_backend_returned_non_mock_answer", False,
                   f"no successful visible assistant reply within timeout: {type(exc).__name__}: {str(exc)[:300]}")
            await page.screenshot(path=str(out / "real-chat-failed.png"), full_page=True)

        # Memory is tested only within this disposable context, never the user's phone storage.
        try:
            await page.wait_for_function(
                "() => !!window.MosharrofPersonalMemory && typeof window.MosharrofPersonalMemory.list === 'function'",
                timeout=10000,
            )
            rows = await page.evaluate("async () => window.MosharrofPersonalMemory.list(100)")
            saved_prompt = any(row.get("kind") == "user" and prompt in row.get("text", "") for row in rows)
            saved_answer = bool(answer) and any(row.get("kind") == "assistant" and answer[:80] in row.get("text", "") for row in rows)
            record("synthetic_prompt_and_real_answer_saved_to_browser_memory", saved_prompt and saved_answer,
                   f"memory_rows={len(rows)}; prompt_saved={saved_prompt}; answer_saved={saved_answer}")
        except Exception as exc:
            record("synthetic_prompt_saved_to_browser_memory", False,
                   f"{type(exc).__name__}: {str(exc)[:250]}")

        await context.close()
        await browser.close()

    (out / "real-chat-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("REAL LIVE CHAT SMOKE TEST: " + (
        "PASS" if report["checks"] and all(c["passed"] for c in report["checks"]) else "FAIL"
    ))
    print("Evidence: real-chat-report.json and real-chat-before/after screenshots")
    return 0 if report["checks"] and all(c["passed"] for c in report["checks"]) else 1

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
