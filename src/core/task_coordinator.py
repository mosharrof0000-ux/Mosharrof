"""Safe task lifecycle contract for the Mosharrof AI Ecosystem.

This coordinator plans and authorizes work; it does not execute providers,
control devices, or publish content. Runtime execution adapters must call
authorize_task() successfully before invoking an external side effect.
Task records are currently process-local and are not a durable queue.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from src.core.universal_permission_engine import UniversalPermissionEngine


TERMINAL_STATES = {"SUCCEEDED", "FAILED", "DENIED"}
VALID_STATES = {
    "RECEIVED",
    "AWAITING_APPROVAL",
    "READY",
    "RUNNING",
    "SUCCEEDED",
    "FAILED",
    "DENIED",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskCoordinator:
    """Fail-closed task state machine using the shared capability permission gate."""

    def __init__(self, permission_engine: UniversalPermissionEngine | None = None):
        self.permission_engine = permission_engine or UniversalPermissionEngine()
        self._tasks: dict[str, dict[str, Any]] = {}

    def create_task(
        self,
        *,
        capability: str,
        entity_id: str,
        resource_scope: str,
        entity_scope: str,
        granted_permissions: list[str] | tuple[str, ...] = (),
        policy_ok: bool = False,
        provider_ready: bool = False,
        requires_approval: bool = False,
        summary: str = "",
        task_id: str | None = None,
    ) -> dict[str, Any]:
        """Register a task without running it; high-impact work waits for approval."""
        identifier = (task_id or str(uuid4())).strip()
        if not identifier or identifier in self._tasks:
            raise ValueError("task_id must be non-empty and unique")
        capability = (capability or "").strip().lower()
        entity_id = (entity_id or "").strip()
        if not capability or not entity_id:
            raise ValueError("capability and entity_id are required")

        state = "AWAITING_APPROVAL" if requires_approval else "RECEIVED"
        task = {
            "task_id": identifier,
            "capability": capability,
            "entity_id": entity_id,
            "resource_scope": resource_scope or "",
            "entity_scope": entity_scope or "",
            "granted_permissions": list(granted_permissions),
            "policy_ok": bool(policy_ok),
            "provider_ready": bool(provider_ready),
            "requires_approval": bool(requires_approval),
            "user_approved": False,
            "summary": str(summary or "")[:500],
            "state": state,
            "created_at": _now(),
            "updated_at": _now(),
            "decision": None,
            "result_summary": None,
        }
        self._tasks[identifier] = task
        return deepcopy(task)

    def approve_task(self, task_id: str, *, approved: bool) -> dict[str, Any]:
        """Record explicit approval or rejection before authorization."""
        task = self._get(task_id)
        if task["state"] != "AWAITING_APPROVAL":
            raise ValueError("task is not awaiting approval")
        task["user_approved"] = bool(approved)
        task["state"] = "RECEIVED" if approved else "DENIED"
        task["decision"] = {
            "status": "APPROVED" if approved else "DENIED",
            "reason": "USER_APPROVED" if approved else "USER_REJECTED",
            "timestamp": _now(),
        }
        self._touch(task)
        return deepcopy(task)

    def authorize_task(self, task_id: str) -> dict[str, Any]:
        """Run permission gates; success means READY, not that execution occurred."""
        task = self._get(task_id)
        if task["state"] == "AWAITING_APPROVAL":
            return {
                "task_id": task_id,
                "state": task["state"],
                "decision": {"status": "DENIED", "reason": "USER_APPROVAL_REQUIRED"},
            }
        if task["state"] != "RECEIVED":
            raise ValueError("only RECEIVED tasks can be authorized")

        decision = self.permission_engine.authorize(
            task["capability"],
            entity_id=task["entity_id"],
            granted_permissions=task["granted_permissions"],
            resource_scope=task["resource_scope"],
            entity_scope=task["entity_scope"],
            policy_ok=task["policy_ok"],
            provider_ready=task["provider_ready"],
            user_approved=task["user_approved"],
        )
        task["decision"] = {**decision, "timestamp": _now()}
        task["state"] = "READY" if decision["status"] == "ALLOWED" else "DENIED"
        self._touch(task)
        return deepcopy(task)

    def mark_running(self, task_id: str) -> dict[str, Any]:
        """Mark executor start only after a successful authorization decision."""
        task = self._get(task_id)
        if task["state"] != "READY":
            raise ValueError("only authorized READY tasks can start")
        task["state"] = "RUNNING"
        task["started_at"] = _now()
        self._touch(task)
        return deepcopy(task)

    def finish_task(
        self, task_id: str, *, succeeded: bool, result_summary: str = ""
    ) -> dict[str, Any]:
        """Record executor outcome without storing provider secrets or raw payloads."""
        task = self._get(task_id)
        if task["state"] != "RUNNING":
            raise ValueError("only RUNNING tasks can finish")
        task["state"] = "SUCCEEDED" if succeeded else "FAILED"
        task["result_summary"] = str(result_summary or "")[:500]
        task["finished_at"] = _now()
        self._touch(task)
        return deepcopy(task)

    def get_task(self, task_id: str) -> dict[str, Any]:
        return deepcopy(self._get(task_id))

    def list_tasks(self) -> list[dict[str, Any]]:
        return [deepcopy(task) for task in self._tasks.values()]

    def _get(self, task_id: str) -> dict[str, Any]:
        try:
            return self._tasks[task_id]
        except KeyError as exc:
            raise KeyError("unknown task_id") from exc

    @staticmethod
    def _touch(task: dict[str, Any]) -> None:
        if task["state"] not in VALID_STATES:
            raise ValueError("invalid task state")
        task["updated_at"] = _now()
