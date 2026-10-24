#!/usr/bin/env python3
"""Exercise one real chat round-trip inside the installed MOSHARROF Android APK.

Uses the Android WebView page-level Chrome DevTools Protocol directly. Browser-level
Playwright CDP setup is not supported by Android WebView's browser-context API.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen


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
        try:
            health_started = cdp.evaluate(
                """(() => {
                  const controller = new AbortController();
                  const timer = setTimeout(() => controller.abort(), 10000);
                  window.__mosharrofHealthProbeResult = null;
                  window.__mosharrofHealthProbe = fetch(
                    "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/health",
                    {cache: "no-store", signal: controller.signal}
                  ).then(async response => {
                    const data = await response.json().catch(() => ({}));
                    const gemini = Array.isArray(data.gemini_chat_key_slots) &&
                      data.gemini_chat_key_slots.some(Boolean);
                    return {
                      ok: response.ok,
                      status: response.status,
                      build: data.worker_build || null,
                      providers: {
                        cf: !!data.cloudflare_chat_configured,
                        gemini,
                        groq: !!data.groq_chat_configured,
                        or: !!data.openrouter_chat_configured
                      }
                    };
                  }).catch(error => ({
                    ok: false,
                    error: String(error).slice(0, 120)
                  })).then(result => {
                    window.__mosharrofHealthProbeResult = result;
                    return result;
                  }).finally(() => clearTimeout(timer));
                  return true;
                })()""",
                timeout=8,
            )
            report["backend_health"] = {
                "probe_started": bool(health_started),
                "result_pending": True
            }
        except Exception as exc:
            report["backend_health"] = {
                "ok": False,
                "error": f"{type(exc).__name__}: {str(exc)[:120]}"
            }

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
        health = None
        try:
            for _ in range(3):
                health = cdp.evaluate(
                    "window.__mosharrofHealthProbeResult || null",
                    timeout=5,
                )
                if health:
                    break
                time.sleep(0.5)
        except Exception as exc:
            health = {
                "ok": False,
                "error": f"{type(exc).__name__}: {str(exc)[:120]}"
            }
        if not health:
            health = {
                "ok": False,
                "error": "health_probe_result_not_ready"
            }
        report["backend_health"] = health

        if answer:
            stage = "read_provider_metadata"
            response_meta = None
            try:
                response_meta = cdp.evaluate(
                    """(() => {
                      const parse = (key, fallback) => {
                        try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
                        catch (e) { return fallback; }
                      };
                      const sessions = parse("mosharrof_chat_sessions_v1", []);
                      const activeId = localStorage.getItem("mosharrof_active_session_v1");
                      const legacy = parse("mosharrof_chat_v1", null);
                      const current = (Array.isArray(sessions)
                        ? sessions.find(item => item && item.id === activeId) : null) || legacy;
                      const messages = current && Array.isArray(current.messages) ? current.messages : [];
                      const last = [...messages].reverse().find(item =>
                        item && item.role === "ai" && item.responseMeta
                      );
                      if (!last || !last.responseMeta) return null;
                      const meta = last.responseMeta;
                      return {
                        provider: meta.provider || null,
                        model: meta.model || null,
                        failed: !!meta.failed,
                        attempted: Array.isArray(meta.attempted) ? meta.attempted.map(item => ({
                          provider: item && item.provider || null,
                          model: item && item.model || null,
                          status: item && item.status || null,
                          reason: String(item && item.reason || "").slice(0, 160)
                        })) : []
                      };
                    })()""",
                    timeout=8,
                )
            except Exception as exc:
                report["response_metadata_error"] = (
                    f"{type(exc).__name__}: {str(exc)[:120]}"
                )
            if isinstance(response_meta, dict):
                provider = response_meta.get("provider") or provider
                report["response_model"] = response_meta.get("model")
                report["provider_attempts"] = response_meta.get("attempted") or []
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
                "ai সংযোগ ব্যর্থ",
                "আবার চেষ্টা করুন",
                "নেটওয়ার্ক সংযোগ",
                "সার্ভারে সমস্যা",
                "server error",
                "service unavailable",
                "connection failed",
                "unable to connect",
            ]
            failure_marker = next((phrase for phrase in failed_phrases if phrase in lower), "")
            known_provider = provider in {
                "gemini", "cloudflare-workers-ai", "groq", "openrouter"
            }
            metadata_failed = bool(
                isinstance(response_meta, dict) and response_meta.get("failed")
            )
            passed = bool(answer) and not failure_marker and known_provider and not metadata_failed
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
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if cdp is not None:
            try:
                cdp.close()
            except Exception:
                pass

    return 0 if report["checks"] and all(check["passed"] for check in report["checks"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
