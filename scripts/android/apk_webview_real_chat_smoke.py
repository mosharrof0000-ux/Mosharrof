#!/usr/bin/env python3
"""Exercise one real chat round-trip inside the installed MOSHARROF Android APK.

Uses the Android WebView page-level Chrome DevTools Protocol directly. Browser-level
Playwright CDP setup is not supported by Android WebView's browser-context API.
"""
from __future__ import annotations

import argparse
import base64
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

import websocket

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


class PageCDP:
    """Minimal page-target CDP client with bounded retries for idempotent commands."""

    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=15)
        self.next_id = 0

    def command(self, method: str, params: dict | None = None, timeout: float = 15, retries: int = 0) -> dict:
        for attempt in range(retries + 1):
            self.next_id += 1
            command_id = self.next_id
            self.ws.settimeout(timeout)
            self.ws.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
            deadline = time.monotonic() + timeout
            try:
                while time.monotonic() < deadline:
                    message = json.loads(self.ws.recv())
                    if message.get("id") != command_id:
                        continue
                    if "error" in message:
                        raise RuntimeError(f"CDP {method} failed: {message['error']}")
                    return message.get("result", {})
            except websocket.WebSocketTimeoutException:
                if attempt >= retries:
                    raise
                report["cdp_retry_events"].append({
                    "method": method, "attempt": attempt + 1, "reason": "response_timeout"
                })
                time.sleep(0.25)
        raise TimeoutError(f"Timed out waiting for CDP command {method}")

    def evaluate(self, expression: str, timeout: float = 15, retry_safe: bool = False):
        result = self.command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            timeout=timeout,
            retries=2 if retry_safe else 0,
        )
        if "exceptionDetails" in result:
            raise RuntimeError(f"Page JavaScript exception: {result['exceptionDetails']}")
        return result.get("result", {}).get("value")

    def screenshot(self, path: Path) -> None:
        result = self.command(
            "Page.captureScreenshot",
            {"format": "png", "captureBeyondViewport": True},
            retries=2,
        )
        path.write_bytes(base64.b64decode(result["data"]))

    def close(self) -> None:
        self.ws.close()

def get_targets() -> list[dict]:
    target_file = out / "webview-targets.json"
    if target_file.is_file():
        return json.loads(target_file.read_text(encoding="utf-8"))
    endpoint = args.cdp_endpoint.rstrip("/") + "/json/list"
    with urlopen(endpoint, timeout=15) as response:
        return json.load(response)


def main() -> int:
    cdp = None
    try:
        report["stage"] = "discovering_webview_target"
        if report["launch_evidence"]["screenshot_status"] != "CAPTURED":
            record("launch_screenshot_captured", False, "Launch screenshot was not captured; see launch-screenshot-status.txt")
        else:
            record("launch_screenshot_captured", True, "Launch screenshot captured before chat interaction")
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
        cdp = PageCDP(target["webSocketDebuggerUrl"])
        cdp.command("Page.enable", retries=2)
        cdp.command("Runtime.enable", retries=2)
        try:
            cdp.command("Page.bringToFront", timeout=5, retries=1)
        except Exception:
            pass

        report["stage"] = "checking_chat_composer"
        deadline = time.monotonic() + 30
        ready = False
        while time.monotonic() < deadline:
            ready = bool(cdp.evaluate(
                "Boolean(document.querySelector('#input') && document.querySelector('#sendBtn') && "
                "document.querySelector('#input').getClientRects().length)",
                retry_safe=True,
            ))
            if ready:
                break
            time.sleep(0.5)
        record("chat_composer_visible_in_apk", ready, "Visible #input and #sendBtn found in installed app WebView")
        if not ready:
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
                    provider: last ? last.getAttribute('data-provider') : null
                  }};
                }})()""",
                retry_safe=True,
            )
            if state and state.get("ready"):
                answer = state.get("answer", "").strip()
                provider = state.get("provider")
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
            mock_provider = not provider_name or any(token in provider_name for token in ("mock", "test", "fixture", "playwright"))
            passed = bool(answer) and not failure_marker and not mock_provider
            record("real_backend_returned_non_mock_answer", passed,
                   f"response_chars={len(answer)}; provider_present={bool(provider_name)}; "
                   f"mock_provider={mock_provider}; failure_marker={failure_marker or 'none'}")
            report["response_preview"] = answer[:240]
            report["response_provider"] = provider
            report["stage"] = "capturing_after_response"
            cdp.screenshot(out / "apk-webview-after.png")
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
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if cdp is not None:
            try:
                cdp.close()
            except Exception:
                pass

    return 0 if report["checks"] and all(check["passed"] for check in report["checks"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
