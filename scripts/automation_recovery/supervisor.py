"""Restart and resume primitives for Mosharrof automation workers.

This module is deliberately provider-agnostic. A host service must call
Supervisor.tick() on a schedule and provide a real restart callback. It does
not claim to keep itself alive if its own host process is killed.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Protocol


@dataclass(frozen=True)
class Incident:
    kind: str
    detail: str
    attempt: int
    timestamp: float


@dataclass
class Checkpoint:
    task_id: str
    stage: str
    payload: dict
    updated_at: float


class IncidentAdvisor(Protocol):
    def diagnose(self, incident: Incident) -> str: ...


class RuleBasedAdvisor:
    """Safe local fallback; never sends logs or secrets to an external service."""

    def diagnose(self, incident: Incident) -> str:
        text = f"{incident.kind} {incident.detail}".lower()
        if any(x in text for x in ("401", "403", "permission", "unauthorized")):
            return "permission_or_auth: verify least-privilege credentials; do not retry unchanged."
        if any(x in text for x in ("429", "quota", "rate limit")):
            return "rate_limited: honor Retry-After and use exponential backoff."
        if any(x in text for x in ("timeout", "timed out", "connection", "503", "502")):
            return "transient_network_or_service: bounded retry may be appropriate."
        if any(x in text for x in ("checkpoint", "decode", "json", "corrupt")):
            return "checkpoint_or_data_integrity: preserve evidence and validate before resume."
        return "unknown: preserve logs, avoid destructive changes, and require review."


class AIIncidentAdvisor:
    """Optional AI adapter. Supply a real, approved model-call function to enable it.

    The callback receives only a compact, redacted incident summary. Without a
    configured callback this uses the deterministic local advisor; it does not
    pretend an AI provider is connected.
    """

    def __init__(self, model_call: Callable[[str], str] | None = None):
        self.model_call = model_call
        self.fallback = RuleBasedAdvisor()

    def diagnose(self, incident: Incident) -> str:
        if self.model_call is None:
            return "AI_NOT_CONFIGURED; " + self.fallback.diagnose(incident)
        summary = {
            "kind": incident.kind[:80],
            "detail": _redact(incident.detail)[:300],
            "attempt": max(0, incident.attempt),
        }
        try:
            answer = self.model_call(json.dumps(summary, ensure_ascii=False))
            if isinstance(answer, str) and answer.strip():
                return "ai_advice_unverified: " + answer.strip()[:500]
        except Exception:
            pass
        return "AI_CALL_FAILED; " + self.fallback.diagnose(incident)


def _redact(value: str) -> str:
    """Remove common secret-shaped values before sending incident context to AI."""
    import re

    value = re.sub(r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*\S+", r"\1=[REDACTED]", value)
    value = re.sub(r"Bearer\s+\S+", "Bearer [REDACTED]", value, flags=re.I)
    return value


def save_checkpoint(path: str | Path, checkpoint: Checkpoint) -> None:
    """Atomically persist a JSON checkpoint so a partial write is not mistaken for valid state."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(asdict(checkpoint), ensure_ascii=False, sort_keys=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, target)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def load_checkpoint(path: str | Path) -> Checkpoint | None:
    target = Path(path)
    if not target.exists():
        return None
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        if not all(isinstance(data.get(k), str) and data[k] for k in ("task_id", "stage")):
            return None
        if not isinstance(data.get("payload"), dict):
            return None
        return Checkpoint(
            task_id=data["task_id"],
            stage=data["stage"],
            payload=data["payload"],
            updated_at=float(data["updated_at"]),
        )
    except (OSError, ValueError, TypeError, KeyError):
        return None


class Supervisor:
    """A single-worker watchdog, intended to be called by an external scheduler."""

    def __init__(
        self,
        restart: Callable[[], bool],
        advisor: IncidentAdvisor | None = None,
        max_restarts: int = 3,
        backoff_seconds: float = 30.0,
        clock: Callable[[], float] = time.time,
    ):
        if max_restarts < 0 or backoff_seconds < 0:
            raise ValueError("retry limits must be non-negative")
        self.restart = restart
        self.advisor = advisor or AIIncidentAdvisor()
        self.max_restarts = max_restarts
        self.backoff_seconds = backoff_seconds
        self.clock = clock
        self.attempts = 0
        self.last_attempt_at = 0.0
        self.last_incident: Incident | None = None

    def tick(self, healthy: bool, detail: str = "heartbeat missing") -> dict:
        now = self.clock()
        if healthy:
            self.attempts = 0
            self.last_incident = None
            return {"status": "healthy", "attempts": 0}
        incident = Incident("worker_unhealthy", detail, self.attempts, now)
        self.last_incident = incident
        diagnosis = self.advisor.diagnose(incident)
        if self.attempts >= self.max_restarts:
            return {"status": "manual_intervention_required", "attempts": self.attempts, "diagnosis": diagnosis}
        delay = self.backoff_seconds * (2 ** self.attempts)
        if self.attempts and now - self.last_attempt_at < delay:
            return {"status": "backoff", "attempts": self.attempts, "retry_after_seconds": delay - (now - self.last_attempt_at), "diagnosis": diagnosis}
        self.attempts += 1
        self.last_attempt_at = now
        try:
            restarted = bool(self.restart())
        except Exception as exc:
            restarted = False
            detail = f"{type(exc).__name__}: {_redact(str(exc))[:200]}"
        return {
            "status": "restart_requested" if restarted else "restart_failed",
            "attempts": self.attempts,
            "diagnosis": self.advisor.diagnose(Incident("restart_result", detail, self.attempts, now)),
        }
