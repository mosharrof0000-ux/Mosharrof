#!/usr/bin/env python3
"""Exercise one real chat round-trip inside the installed MOSHARROF Android APK.

Connects Playwright to the Android System WebView's debug-only CDP endpoint.
Uses one synthetic Bengali prompt, saves screenshots/report evidence, and never
logs credentials. The request may consume provider quota.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--cdp-endpoint", default="http://127.0.0.1:9222")
parser.add_argument("--output-dir", default="artifacts/apk-webview-chat")
parser.add_argument("--timeout-ms", type=int, default=90000)
args = parser.parse_args()

out = Path(args.output_dir)
out.mkdir(parents=True, exist_ok=True)
prompt = "APK WebView লাইভ চ্যাট সংযোগ পরীক্ষা। অনুগ্রহ করে শুধু লিখুন: APK চ্যাট পরীক্ষা সফল।"
report = {
    "agent": "MOSHARROF installed APK WebView real-chat smoke test",
    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    "cdp_endpoint": args.cdp_endpoint,
    "mode": "installed_android_apk_webview_real_backend_one_synthetic_prompt",
    "policy": {
        "synthetic_prompt_only": True,
        "real_backend_request": True,
        "may_consume_provider_quota": True,
        "credentials_logged": False,
        "physical_phone_test": False,
    },
    "checks": [],
    "errors": [],
}

def record(name: str, passed: bool, detail: str = "") -> None:
    report["checks"].append({"name": name, "passed": bool(passed), "detail": detail})
    if not passed:
        report["errors"].append({"check": name, "detail": detail})

async def main() -> int:
    browser = None
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.connect_over_cdp(args.cdp_endpoint, timeout=15000)
            page = None
            deadline = asyncio.get_running_loop().time() + 30
            while asyncio.get_running_loop().time() < deadline and page is None:
                for context in browser.contexts:
                    for candidate in context.pages:
                        url = candidate.url.lower()
                        if "localhost" in url or url.startswith("capacitor://"):
                            page = candidate
                            break
                    if page is not None:
                        break
                if page is None:
                    await asyncio.sleep(0.5)

            record("connected_to_installed_apk_webview", page is not None,
                   f"page_url={(page.url if page else 'no app WebView target')}")
            if page is None:
                return 1

            page.set_default_timeout(min(args.timeout_ms, 15000))
            page.on("pageerror", lambda exc: report["errors"].append(
                {"type": "pageerror", "detail": str(exc)[:400]}))
            await page.wait_for_selector("#input", state="visible", timeout=30000)
            await page.wait_for_selector("#sendBtn", state="visible", timeout=10000)
            record("chat_composer_visible_in_apk", True, "Visible #input and #sendBtn found in the app's WebView")
            await page.screenshot(path=str(out / "apk-webview-before.png"), full_page=True)

            baseline = await page.locator("#messages .message.ai:not(.typing)").count()
            await page.locator("#input").fill(prompt)
            await page.locator("#sendBtn").click()
            record("synthetic_prompt_submitted", True, "One Bengali prompt submitted through the installed APK UI")

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
                    "inspector mock response",
                    "playwright-safe-test",
                    "you exceeded your current quota",
                    "quota exceeded",
                    "failed to fetch",
                    "network error",
                    "অনুরোধটি ব্যর্থ",
                    "সংযোগে সমস্যা",
                    "এই মুহূর্তে gemini সংযোগে সমস্যা",
                ]
                failure_marker = next((phrase for phrase in failed_phrases if phrase in lower), "")
                passed = bool(answer) and not failure_marker
                record("real_backend_returned_non_mock_answer", passed,
                       f"response_chars={len(answer)}; failure_marker={failure_marker or 'none'}")
                report["response_preview"] = answer[:240]
                report["response_provider"] = await nodes.last.get_attribute("data-provider")
                await page.screenshot(path=str(out / "apk-webview-after.png"), full_page=True)
            except Exception as exc:
                record("real_backend_returned_non_mock_answer", False,
                       f"{type(exc).__name__}: {str(exc)[:300]}")
                try:
                    await page.screenshot(path=str(out / "apk-webview-failed.png"), full_page=True)
                except Exception:
                    pass
    except Exception as exc:
        record("cdp_connection_and_chat", False, f"{type(exc).__name__}: {str(exc)[:500]}")
    finally:
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if browser is not None:
            try:
                await browser.close()
            except Exception:
                pass

    return 0 if report["checks"] and all(check["passed"] for check in report["checks"]) else 1

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
