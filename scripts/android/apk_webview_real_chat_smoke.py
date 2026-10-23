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


def record(name: str, passed: bool, detail: str = "") -> None:
    report["checks"].append({"name": name, "passed": bool(passed), "detail": detail})
    if not passed:
        report["errors"].append({"check": name, "detail": detail})


class PageCDP:
    """Minimal page-target CDP client, avoiding unsupported Browser-domain methods."""

    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=15, suppress_origin=True)
        self.next_id = 0

    def command(self, method: str, params: dict | None = None, timeout: float = 15) -> dict:
        self.next_id += 1
        command_id = self.next_id
        self.ws.settimeout(timeout)
        self.ws.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            message = json.loads(self.ws.recv())
            if message.get("id") != command_id:
                continue
            if "error" in message:
                raise RuntimeError(f"CDP {method} failed: {message['error']}")
            return message.get("result", {})
        raise TimeoutError(f"Timed out waiting for CDP command {method}")

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
        result = self.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
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

        cdp = PageCDP(target["webSocketDebuggerUrl"])
        cdp.command("Page.enable")
        cdp.command("Runtime.enable")
        try:
            cdp.command("Page.bringToFront", timeout=5)
        except Exception:
            pass

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

        cdp.screenshot(out / "apk-webview-before.png")
        baseline = int(cdp.evaluate("document.querySelectorAll('#messages .message.ai:not(.typing)').length") or 0)
        # Use CDP's native input events instead of invoking send.click() inside
        # Runtime.evaluate. Some WebView builds block the evaluate response while
        # the application's synchronous click handler starts the request.
        prompt_rect = cdp.evaluate(
            """(() => {
              const el = document.querySelector('#input');
              const r = el && el.getBoundingClientRect();
              return r ? {x:r.x+r.width/2, y:r.y+r.height/2} : null;
            })()"""
        )
        send_rect = cdp.evaluate(
            """(() => {
              const el = document.querySelector('#sendBtn');
              const r = el && el.getBoundingClientRect();
              return r ? {x:r.x+r.width/2, y:r.y+r.height/2, disabled:!!el.disabled} : null;
            })()"""
        )
        if not prompt_rect or not send_rect or send_rect.get("disabled"):
            raise RuntimeError("Composer or enabled send button has no usable screen coordinates")

        cdp.command("Input.dispatchMouseEvent", {
            "type": "mousePressed", "x": prompt_rect["x"], "y": prompt_rect["y"],
            "button": "left", "clickCount": 1,
        }, timeout=30)
        cdp.command("Input.dispatchMouseEvent", {
            "type": "mouseReleased", "x": prompt_rect["x"], "y": prompt_rect["y"],
            "button": "left", "clickCount": 1,
        }, timeout=30)
        cdp.command("Input.insertText", {"text": prompt}, timeout=30)
        entered = cdp.evaluate(
            "document.querySelector('#input')?.value === " + json.dumps(prompt, ensure_ascii=False),
            timeout=30,
        )
        if not entered:
            raise RuntimeError("Native WebView text input did not populate the chat composer")

        cdp.command("Input.dispatchMouseEvent", {
            "type": "mousePressed", "x": send_rect["x"], "y": send_rect["y"],
            "button": "left", "clickCount": 1,
        }, timeout=30)
        cdp.command("Input.dispatchMouseEvent", {
            "type": "mouseReleased", "x": send_rect["x"], "y": send_rect["y"],
            "button": "left", "clickCount": 1,
        }, timeout=30)
        record("synthetic_prompt_submitted", True,
               "One Bengali prompt entered and sent through native WebView input events")
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
            cdp.screenshot(out / "apk-webview-failed.png")
    except Exception as exc:
        record("cdp_connection_and_chat", False, f"{type(exc).__name__}: {str(exc)[:500]}")
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
