#!/usr/bin/env python3
"""Exercise one real chat round-trip inside the installed MOSHARROF Android APK.

Uses the Android WebView page-level Chrome DevTools Protocol directly. Browser-level
Playwright CDP setup is not supported by Android WebView's browser-context API.
"""
from __future__ import annotations

import argparse
import json
import time
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".github" / "scripts"))
from android_qa_cdp import PageCDP, inspect_answer_visibility, resolve_provider
from android_qa_targets import fetch_webview_targets


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
    "launch_evidence": {
        "screenshot_status": (out / "launch-screenshot-status.txt").read_text(encoding="utf-8").strip()
            if (out / "launch-screenshot-status.txt").is_file() else "NOT_CAPTURED",
        "activity_status": (out / "launch-activity-status.txt").read_text(encoding="utf-8").strip()
            if (out / "launch-activity-status.txt").is_file() else "NOT_CONFIRMED",
        "ui_state": (out / "launch-ui-diagnostic.txt").read_text(encoding="utf-8").strip()
            if (out / "launch-ui-diagnostic.txt").is_file() else "NOT_CHECKED",
    },
    "stage": "initializing",
    "cdp_retry_events": [],
    "checks": [],
    "errors": [],
}


def record(name: str, passed: bool, detail: str = "") -> None:
    report["checks"].append({"name": name, "passed": bool(passed), "detail": detail})
    if not passed:
        report["errors"].append({"check": name, "detail": detail})


def get_targets() -> list[dict]:
    return fetch_webview_targets(args.cdp_endpoint, out / "webview-targets.json")


def main() -> int:
    cdp = None
    try:
        report["stage"] = "discovering_webview_target"
        activity_status = report["launch_evidence"]["activity_status"]
        record("launch_activity_displayed", activity_status == "DISPLAYED",
               f"MainActivity first-display status={activity_status}")
        launch_png = out / "apk-webview-launch.png"
        launch_captured = (report["launch_evidence"]["screenshot_status"] == "CAPTURED"
                           and launch_png.is_file() and launch_png.stat().st_size > 100)
        record("launch_screenshot_captured", launch_captured,
               "Launch screenshot captured before chat interaction" if launch_captured
               else "Launch screenshot missing/invalid; see launch-screenshot-status.txt")
        ui_state = report["launch_evidence"]["ui_state"]
        if ui_state == "SYSTEM_ANR_DIALOG":
            report["launch_evidence"]["warning"] = "Android system/UI ANR dialog detected; chat result is evaluated separately"
            record("launch_ui_state_clean", False, "Android system/UI ANR dialog detected in launch UI")
        elif ui_state == "NO_SYSTEM_ANR_DIALOG":
            record("launch_ui_state_clean", True, "No Android system/UI ANR dialog detected in launch UI")
        else:
            record("launch_ui_state_clean", False, "Launch UI classification unavailable; see launch-ui-diagnostic.txt")
        targets = get_targets()
        target = next(
            (item for item in targets if item.get("type") == "page" and
             ("localhost" in item.get("url", "").lower() or item.get("url", "").lower().startswith("capacitor://"))),
            None,
        )
        record("installed_apk_webview_target_found", target is not None,
               f"target_url={(target.get('url') if target else 'no app WebView target')}")
        if target is None:
            return 1

        report["stage"] = "connecting_cdp"
        cdp = PageCDP(target["webSocketDebuggerUrl"], report["cdp_retry_events"])
        cdp.command("Page.enable", retries=2)
        cdp.command("Runtime.enable", retries=2)
        try:
            cdp.command("Page.bringToFront", timeout=5, retries=1)
        except Exception:
            pass

        report["stage"] = "checking_chat_composer"
        deadline = time.monotonic() + 30
        layout_ready = False
        composer_ready = False
        while time.monotonic() < deadline:
            layout_ready = bool(cdp.evaluate(
                "window.__mosharrofChatLayoutCompatReady === true",
                retry_safe=True,
            ))
            composer_ready = bool(cdp.evaluate(
                "Boolean(document.querySelector('#input') && document.querySelector('#sendBtn') && "
                "document.querySelector('#input').getClientRects().length)",
                retry_safe=True,
            ))
            if layout_ready and composer_ready:
                break
            time.sleep(0.5)
        record("chat_layout_compat_ready", layout_ready,
               "Explicit chat sizing fallback initialized" if layout_ready
               else "Chat sizing compatibility module did not initialize")
        record("chat_composer_visible_in_apk", composer_ready,
               "Visible #input and #sendBtn found in installed app WebView" if composer_ready
               else "Chat composer not visible in installed app WebView")
        if not layout_ready:
            raise TimeoutError("Chat layout compatibility module did not initialize")
        if not composer_ready:
            raise TimeoutError("APK chat composer did not become visible")

        report["stage"] = "capturing_before_chat"
        cdp.screenshot(out / "apk-webview-before.png")
        baseline = int(cdp.evaluate(
            "document.querySelectorAll('#messages .message.ai:not(.typing)').length",
            retry_safe=True,
        ) or 0)
        prompt_js = json.dumps(prompt, ensure_ascii=False)
        report["stage"] = "submitting_synthetic_bengali_prompt"
        submitted = cdp.evaluate(
            f"""(() => {{
              const input = document.querySelector('#input');
              const send = document.querySelector('#sendBtn');
              if (!input || !send || send.disabled) return false;
              input.focus();
              input.value = {prompt_js};
              input.dispatchEvent(new Event('input', {{bubbles:true}}));
              input.dispatchEvent(new Event('change', {{bubbles:true}}));
              send.click();
              return true;
            }})()"""
        )
        record("synthetic_prompt_submitted", bool(submitted), "One Bengali prompt submitted through the installed APK UI")
        if not submitted:
            raise RuntimeError("Could not submit synthetic prompt through the app composer")

        report["stage"] = "waiting_for_backend_answer"
        deadline = time.monotonic() + args.timeout_ms / 1000
        answer = ""
        provider = None
        response_route = ""
        while time.monotonic() < deadline:
            state = cdp.evaluate(
                f"""(() => {{
                  const send = document.querySelector('#sendBtn');
                  const typing = document.querySelector('#typing');
                  const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
                  const last = nodes[nodes.length - 1];
                  const body = last && last.querySelector('.rich-content');
                  return {{
                    ready: !!send && !send.disabled && !typing && nodes.length > {baseline} &&
                           !!body && body.innerText.trim().length > 0,
                    count: nodes.length,
                    typing: !!typing,
                    answer: body ? body.innerText.trim() : '',
                    provider: last ? last.getAttribute('data-provider') : null,
                    route: last && last.querySelector('.response-route')
                      ? last.querySelector('.response-route').innerText.trim() : ''
                  }};
                }})()""",
                retry_safe=True,
            )
            if state and state.get("ready"):
                answer = state.get("answer", "").strip()
                provider = state.get("provider")
                response_route = str(state.get("route") or "").strip()
                provider = resolve_provider(provider, response_route)
                break
            time.sleep(1)

        if answer:
            lower = answer.lower()
            failed_phrases = [
                "inspector mock response", "playwright-safe-test", "mock response",
                "you exceeded your current quota", "quota exceeded", "http 429", "quota",
                "failed to fetch", "network error", "server error", "service unavailable",
                "connection failed", "unable to connect", "unable to resolve host",
                "ai সংযোগ ব্যর্থ", "আবার চেষ্টা করুন", "নেটওয়ার্ক সংযোগ",
                "সার্ভারে সমস্যা", "সংযোগে সমস্যা", "সার্ভার সংযোগ",
                "এই মুহূর্তে gemini সংযোগে সমস্যা",
            ]
            failure_marker = next((phrase for phrase in failed_phrases if phrase in lower), "")
            provider_name = str(provider or "").strip().lower()
            known_provider = any(name in provider_name for name in ("gemini", "workers ai", "groq", "openrouter"))
            mock_provider = (not known_provider) or any(token in provider_name for token in ("mock", "test", "fixture", "playwright"))
            passed = bool(answer) and not failure_marker and not mock_provider
            record("real_backend_returned_non_mock_answer", passed,
                   f"response_chars={len(answer)}; provider_present={bool(provider_name)}; "
                   f"mock_provider={mock_provider}; failure_marker={failure_marker or 'none'}")
            report["response_preview"] = answer[:240]
            report["response_provider"] = provider
            report["response_route"] = response_route
            report["stage"] = "checking_answer_screenshot_visibility"
            visibility = inspect_answer_visibility(cdp)
            time.sleep(0.5)
            cdp.screenshot(out / "apk-webview-after.png")
            screenshot_visible = bool(visibility and visibility.get("visible") and visibility.get("text"))
            record("assistant_answer_visible_in_saved_screenshot", screenshot_visible,
                   json.dumps(visibility, ensure_ascii=False)[:500])
            report["screenshot_answer_visible"] = screenshot_visible
        else:
            record("real_backend_returned_non_mock_answer", False,
                   f"Timed out waiting for assistant reply after {args.timeout_ms} ms")
            report["stage"] = "capturing_after_timeout"
            cdp.screenshot(out / "apk-webview-failed.png")
    except Exception as exc:
        record("cdp_connection_and_chat", False,
               f"stage={report.get('stage', 'unknown')}; {type(exc).__name__}: {str(exc)[:500]}")
        if cdp is not None:
            try:
                cdp.screenshot(out / "apk-webview-failed.png")
            except Exception:
                pass
    finally:
        report["status"] = "PASS" if report["checks"] and all(check["passed"] for check in report["checks"]) else "FAIL"
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if cdp is not None:
            try:
                cdp.close()
            except Exception:
                pass

    return 0 if report["checks"] and all(check["passed"] for check in report["checks"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
