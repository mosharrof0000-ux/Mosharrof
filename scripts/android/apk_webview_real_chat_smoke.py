#!/usr/bin/env python3
"""Exercise one real chat round-trip inside the installed MOSHARROF Android APK.

Uses the Android WebView page-level Chrome DevTools Protocol directly. Browser-level
Playwright CDP setup is not supported by Android WebView's browser-context API.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / ".github" / "scripts"))

from android_qa_diagnostics import (
    classify_real_answer,
    read_backend_health_probe,
    read_response_metadata,
    record_launch_screenshot_diagnostics,
    start_backend_health_probe,
)
from apk_webview_cdp import PageCDP
from apk_webview_visibility import ensure_answer_visible

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
    "warnings": [],
    "launch_screenshot": {"status": "not_checked", "captured": False},
}


def record(name: str, passed: bool, detail: str = "") -> None:
    report["checks"].append({"name": name, "passed": bool(passed), "detail": detail})
    if not passed:
        report["errors"].append({"check": name, "detail": detail})


def get_targets() -> list[dict]:
    target_file = out / "webview-targets.json"
    if target_file.is_file():
        return json.loads(target_file.read_text(encoding="utf-8"))
    endpoint = args.cdp_endpoint.rstrip("/") + "/json/list"
    with urlopen(endpoint, timeout=15) as response:
        return json.load(response)


def main() -> int:
    cdp = None
    stage = "target_discovery"
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

        stage = "connect_cdp"
        cdp = PageCDP(target["webSocketDebuggerUrl"])
        stage = "enable_cdp_domains"
        cdp.command("Page.enable")
        cdp.command("Runtime.enable")
        try:
            cdp.command("Page.bringToFront", timeout=5)
        except Exception:
            pass

        stage = "composer_readiness"
        deadline = time.monotonic() + 30
        ready = False
        baseline = 0
        while time.monotonic() < deadline:
            state = cdp.evaluate(
                """(() => {
                  const input = document.querySelector('#input');
                  const send = document.querySelector('#sendBtn');
                  return {
                    ready: Boolean(input && send && input.getClientRects().length),
                    baseline: document.querySelectorAll('#messages .message.ai:not(.typing)').length
                  };
                })()"""
            )
            ready = bool(state and state.get("ready"))
            if ready:
                baseline = int(state.get("baseline") or 0)
                break
            time.sleep(0.5)
        record("chat_composer_visible_in_apk", ready, "Visible #input and #sendBtn found in installed app WebView")
        if not ready:
            raise TimeoutError("APK chat composer did not become visible")

        stage = "health_probe_start"
        report["backend_health_probe"] = start_backend_health_probe(cdp)
        report["backend_health"] = report["backend_health_probe"]

        stage = "before_screenshot"
        cdp.screenshot(out / "apk-webview-before.png")
        stage = "submit_prompt"
        prompt_js = json.dumps(prompt, ensure_ascii=False)
        # Use the DOM-native value setter so framework-controlled inputs see the
        # same value as a user edit, then send real keyboard text through CDP.
        # Calling HTMLElement.click() can bypass mobile pointer handlers in WebView.
        prep = cdp.evaluate(
            """(() => {
              const input = document.querySelector('#input');
              const send = document.querySelector('#sendBtn');
              if (!input || !send || send.disabled) return null;
              input.focus();
              const proto = input instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (setter) setter.call(input, '');
              input.dispatchEvent(new Event('input', {bubbles:true}));
              const r = send.getBoundingClientRect();
              return {ok:true, x:r.x+r.width/2, y:r.y+r.height/2,
                tag:input.tagName, type:input.getAttribute('type') || ''};
            })()"""
        )
        if not prep or not prep.get("ok"):
            raise RuntimeError("Could not prepare visible chat composer for input")
        cdp.command("Input.insertText", {"text": prompt}, timeout=10)
        # Dispatch a physical-style tap at the send control's center.
        cdp.command("Input.dispatchMouseEvent", {
            "type": "mousePressed", "x": prep["x"], "y": prep["y"],
            "button": "left", "clickCount": 1
        }, timeout=10)
        cdp.command("Input.dispatchMouseEvent", {
            "type": "mouseReleased", "x": prep["x"], "y": prep["y"],
            "button": "left", "clickCount": 1
        }, timeout=10)
        submitted = True
        record("synthetic_prompt_submitted", submitted,
               f"One Bengali prompt entered with CDP keyboard and tapped send control; input={prep.get('tag')}")

        stage = "wait_for_assistant_response"
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

        stage = "backend_health_result"
        report["backend_health"] = read_backend_health_probe(cdp)

        if answer:
            stage = "read_provider_metadata"
            response_meta, metadata_error = read_response_metadata(cdp)
            if metadata_error:
                report["response_metadata_error"] = metadata_error
            if isinstance(response_meta, dict):
                provider = response_meta.get("provider") or provider
                report["response_model"] = response_meta.get("model")
                report["provider_attempts"] = response_meta.get("attempted") or []
            lower = answer.lower()
            passed, failure_marker, metadata_failed = classify_real_answer(
                answer, provider, response_meta
            )
            record(
                "real_backend_returned_non_mock_answer",
                passed,
                f"response_chars={len(answer)}; failure_marker={failure_marker or 'none'}; "
                f"provider={provider or 'missing'}; metadata_failed={metadata_failed}"
            )
            report["response_preview"] = answer[:240]
            report["response_provider"] = provider
            stage = "verify_answer_visibility"
            visibility = ensure_answer_visible(cdp, answer)
            record(
                "assistant_answer_visible_in_viewport",
                bool(visibility and visibility.get("visible")),
                json.dumps(visibility, ensure_ascii=False)
            )
            stage = "capture_after_screenshot"
            cdp.screenshot(out / "apk-webview-after.png")
        else:
            record("real_backend_returned_non_mock_answer", False,
                   f"Timed out waiting for assistant reply after {args.timeout_ms} ms")
            stage = "capture_timeout_screenshot"
            cdp.screenshot(out / "apk-webview-failed.png")
    except Exception as exc:
        record("cdp_connection_and_chat", False, f"stage={stage}; {type(exc).__name__}: {str(exc)[:500]}")
        if cdp is not None:
            try:
                cdp.screenshot(out / "apk-webview-failed.png")
            except Exception:
                pass
    finally:
        record_launch_screenshot_diagnostics(report, out, record)
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if cdp is not None:
            try:
                cdp.close()
            except Exception:
                pass

    return 0 if report["checks"] and all(check["passed"] for check in report["checks"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
