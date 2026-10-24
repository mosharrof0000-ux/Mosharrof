"""Sanitized Android WebView QA diagnostics kept outside the size-limited runner."""
from __future__ import annotations

import time
from typing import Any

KNOWN_PROVIDERS = {"gemini", "cloudflare-workers-ai", "groq", "openrouter"}


def start_backend_health_probe(cdp: Any) -> dict:
    """Start health fetch asynchronously so a slow endpoint cannot block chat QA."""
    try:
        started = cdp.evaluate(
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
        return {"probe_started": bool(started), "result_pending": True}
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {str(exc)[:120]}"}


def read_backend_health_probe(cdp: Any) -> dict:
    """Read the asynchronous result without waiting on the fetch itself."""
    try:
        for _ in range(3):
            health = cdp.evaluate(
                "window.__mosharrofHealthProbeResult || null",
                timeout=5,
            )
            if health:
                return health
            time.sleep(0.5)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {str(exc)[:120]}"}
    return {"ok": False, "error": "health_probe_result_not_ready"}


def _reason_class(reason: Any) -> str:
    value = str(reason or "").lower()
    if any(term in value for term in ("429", "quota", "rate limit", "resource exhausted")):
        return "quota_or_rate_limit"
    if "not_configured" in value or "not configured" in value:
        return "not_configured"
    if "timeout" in value or "timed out" in value:
        return "timeout"
    if any(term in value for term in ("401", "403", "unauthorized", "forbidden", "invalid api key")):
        return "auth_or_permission"
    if "empty" in value:
        return "empty_response"
    if any(term in value for term in ("500", "502", "503", "service unavailable")):
        return "upstream_server_error"
    return "provider_error" if value else "unspecified"


def read_response_metadata(cdp: Any) -> tuple[dict | None, str | None]:
    """Read provider/model from app-saved metadata; never persist raw provider errors."""
    try:
        raw = cdp.evaluate(
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
        return None, f"{type(exc).__name__}: {str(exc)[:120]}"
    if not isinstance(raw, dict):
        return None, None
    attempts = []
    for item in raw.get("attempted", []):
        if not isinstance(item, dict):
            continue
        attempts.append({
            "provider": item.get("provider"),
            "model": item.get("model"),
            "status": item.get("status"),
            "reason_class": _reason_class(item.get("reason")),
        })
    return {
        "provider": raw.get("provider"),
        "model": raw.get("model"),
        "failed": bool(raw.get("failed")),
        "attempted": attempts,
    }, None


def classify_real_answer(
    answer: str, provider: str | None, metadata: dict | None, failure_phrases: list[str]
) -> tuple[bool, str, bool]:
    """Fail closed: require provider metadata and non-error answer text."""
    lower = answer.lower()
    failure_marker = next((phrase for phrase in failure_phrases if phrase in lower), "")
    metadata_failed = bool(isinstance(metadata, dict) and metadata.get("failed"))
    passed = bool(answer) and not failure_marker and provider in KNOWN_PROVIDERS and not metadata_failed
    return passed, failure_marker, metadata_failed
