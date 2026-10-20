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
    "checks": [],
    "errors": [],
}


current_stage = "initialization"


def stage(name: str) -> None:
    global current_stage
    current_stage = name
    print(f"[apk-chat-qa] stage={name}", flush=True)


def record(name: str, passed: bool, detail: str = "") -> None:
    item = {"name": name, "passed": bool(passed), "detail": detail}
    report["checks"].append(item)
    print(f"[apk-chat-qa] check={name} passed={bool(passed)} detail={detail[:240]}", flush=True)
    if not passed:
        report["errors"].append({"check": name, "detail": detail})


class PageCDP:
    """Minimal page-target CDP client, avoiding unsupported Browser-domain methods."""

    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(
            ws_url,
            timeout=30,
            http_proxy_host=None,
            http_no_proxy=["127.0.0.1", "localhost"],
        )
        self.next_id = 0

    def command(self, method: str, params: dict | None = None, timeout: float = 30) -> dict:
        self.next_id += 1
        command_id = self.next_id
        self.ws.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        deadline = time.monotonic() + timeout
        # CDP emits unrelated events as well as command replies. A short socket
        # receive timeout must not abort the whole command; keep polling until
        # its actual deadline and report the exact method if it never replies.
        self.ws.settimeout(min(1.0, timeout))
        while time.monotonic() < deadline:
            try:
                message = json.loads(self.ws.recv())
            except websocket.WebSocketTimeoutException:
                continue
            if message.get("id") != command_id:
                continue
            if "error" in message:
                raise RuntimeError(f"CDP {method} failed: {message['error']}")
            return message.get("result", {})
        raise TimeoutError(f"Timed out waiting for CDP command {method} after {timeout}s")

    def evaluate(self, expression: str, timeout: float = 15):
        result = self.command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            timeout=timeout,
        )
        if "exceptionDetails" in result:
            raise RuntimeError(f"Page JavaScript exception: {result['exceptionDetails']}")
        return result.get("result", {}).get("value")

    def screenshot(self, path: Path) -> None:
        # Android WebView may stall on captureBeyondViewport; capture the visible viewport only.
        result = self.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}, timeout=30)
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
    stage = "load WebView target list"
    try:
        print(f"[chat-smoke] {stage}", flush=True)
        stage("read_webview_targets")
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

        stage = "connect to WebView DevTools"
        print(f"[chat-smoke] {stage}", flush=True)
        cdp = PageCDP(target["webSocketDebuggerUrl"])
        stage = "enable Page and Runtime domains"
        print(f"[chat-smoke] {stage}", flush=True)
        cdp.command("Page.enable")
        cdp.command("Runtime.enable")
        try:
            cdp.command("Page.bringToFront", timeout=5)
        except Exception:
            pass

        stage = "wait for visible chat composer"
        print(f"[chat-smoke] {stage}", flush=True)
        stage("wait_for_visible_chat_composer")
        deadline = time.monotonic() + 30
        ready = False
        while time.monotonic() < deadline:
            ready = bool(cdp.evaluate(
                "Boolean(document.querySelector('#input') && document.querySelector('#sendBtn') && "
                "document.querySelector('#input').getClientRects().length)"
            ))
            if ready:
                break
            time.sleep(0.5)
        record("chat_composer_visible_in_apk", ready, "Visible #input and #sendBtn found in installed app WebView")
        if not ready:
            raise TimeoutError("APK chat composer did not become visible")

        stage = "capture pre-chat screenshot"
        print(f"[chat-smoke] {stage}", flush=True)
        cdp.screenshot(out / "apk-webview-before.png")
        stage = "count baseline assistant messages"
        print(f"[chat-smoke] {stage}", flush=True)
        baseline = int(cdp.evaluate("document.querySelectorAll('#messages .message.ai:not(.typing)').length") or 0)
        prompt_js = json.dumps(prompt, ensure_ascii=False)
        stage = "submit synthetic prompt through composer"
        print(f"[chat-smoke] {stage}", flush=True)
        stage("submit_synthetic_prompt")
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

        stage = "wait for real backend assistant response"
        print(f"[chat-smoke] {stage}", flush=True)
        stage("wait_for_real_backend_reply")
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
                }})()"""
            )
            if state and state.get("ready"):
                answer = state.get("answer", "").strip()
                provider = state.get("provider")
                break
            time.sleep(1)

        if answer:
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
            report["response_provider"] = provider
            cdp.screenshot(out / "apk-webview-after.png")
        else:
            record("real_backend_returned_non_mock_answer", False,
                   f"Timed out waiting for assistant reply after {args.timeout_ms} ms")
            stage = "capture failed-chat screenshot"
            print(f"[chat-smoke] {stage}", flush=True)
            cdp.screenshot(out / "apk-webview-failed.png")
    except Exception as exc:
        print(f"[chat-smoke] FAILED stage={stage}: {type(exc).__name__}: {str(exc)[:300]}", flush=True)
        record("cdp_connection_and_chat", False, f"stage={stage}; {type(exc).__name__}: {str(exc)[:500]}")
        if cdp is not None:
            try:
                cdp.screenshot(out / "apk-webview-failed.png")
            except Exception:
                pass
    finally:
        report["last_stage"] = current_stage
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if cdp is not None:
            try:
                cdp.close()
            except Exception:
                pass

    return 0 if report["checks"] and all(check["passed"] for check in report["checks"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
