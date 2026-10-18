"""Consent-aware personal routine learning and privacy-preserving shared signals.

This module stores only coarse task metadata, never message text, screenshots,
contacts, or app content. It is an in-memory engine; persistence and Android
integration must be supplied by an authorized caller.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Set, Tuple


@dataclass(frozen=True)
class TaskObservation:
    task_type: str
    weekday: int
    time_slot: int
    succeeded: bool
    observed_at: str
    share_consent: bool


class PersonalLearningEngine:
    """Learns per-user routines and emits only sufficiently common shared signals."""

    def __init__(self, *, min_personal_samples: int = 3, min_shared_users: int = 5):
        if min_personal_samples < 1 or min_shared_users < 2:
            raise ValueError("sample thresholds must be positive (shared users >= 2)")
        self.min_personal_samples = min_personal_samples
        self.min_shared_users = min_shared_users
        self._observations: Dict[str, List[TaskObservation]] = defaultdict(list)

    @staticmethod
    def _validate_task(task_type: str) -> str:
        task = task_type.strip().lower()
        if not task or len(task) > 64 or any(ch.isspace() for ch in task):
            raise ValueError("task_type must be a short, non-empty identifier")
        return task

    def record(
        self,
        user_id: str,
        task_type: str,
        *,
        weekday: int,
        hour: int,
        succeeded: bool,
        learning_enabled: bool,
        share_consent: bool = False,
    ) -> Dict[str, object]:
        """Record coarse metadata only when the user has enabled personal learning."""
        if not learning_enabled:
            return {"status": "IGNORED", "reason": "PERSONAL_LEARNING_DISABLED"}
        if not user_id or not user_id.strip():
            raise ValueError("user_id is required when learning is enabled")
        if not 0 <= weekday <= 6 or not 0 <= hour <= 23:
            raise ValueError("weekday must be 0..6 and hour must be 0..23")
        task = self._validate_task(task_type)
        observation = TaskObservation(
            task_type=task,
            weekday=weekday,
            time_slot=hour // 2,
            succeeded=bool(succeeded),
            observed_at=datetime.now(timezone.utc).isoformat(),
            share_consent=bool(share_consent),
        )
        self._observations[user_id].append(observation)
        return {
            "status": "RECORDED",
            "personal_learning": True,
            "shared_learning": observation.share_consent,
        }

    def predict(
        self,
        user_id: str,
        *,
        weekday: int,
        hour: int,
        confidence_threshold: float = 0.70,
    ) -> List[Dict[str, object]]:
        """Suggest likely routine task types; never executes a predicted task."""
        if not 0 <= weekday <= 6 or not 0 <= hour <= 23:
            raise ValueError("weekday must be 0..6 and hour must be 0..23")
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be between 0 and 1")
        slot = hour // 2
        matching = [
            item for item in self._observations.get(user_id, [])
            if item.weekday == weekday and item.time_slot == slot
        ]
        counts: Dict[str, int] = defaultdict(int)
        successes: Dict[str, int] = defaultdict(int)
        for item in matching:
            counts[item.task_type] += 1
            successes[item.task_type] += int(item.succeeded)
        predictions = []
        for task, count in counts.items():
            if count < self.min_personal_samples:
                continue
            confidence = successes[task] / count
            if confidence >= confidence_threshold:
                predictions.append({
                    "task_type": task,
                    "confidence": round(confidence, 3),
                    "observations": count,
                    "requires_user_confirmation": True,
                    "auto_execute": False,
                })
        return sorted(predictions, key=lambda item: (-float(item["confidence"]), -int(item["observations"]), str(item["task_type"])))

    def shared_insights(self) -> List[Dict[str, object]]:
        """Return cohort-level patterns only after a minimum number of distinct opt-in users."""
        cohorts: Dict[Tuple[str, int, int], Dict[str, object]] = {}
        for user_id, observations in self._observations.items():
            seen_for_user: Set[Tuple[str, int, int]] = set()
            for item in observations:
                if not item.share_consent:
                    continue
                key = (item.task_type, item.weekday, item.time_slot)
                cohort = cohorts.setdefault(key, {"users": set(), "events": 0, "successes": 0})
                cohort["users"].add(user_id)
                cohort["events"] = int(cohort["events"]) + 1
                cohort["successes"] = int(cohort["successes"]) + int(item.succeeded)
                seen_for_user.add(key)
        results = []
        for (task, weekday, slot), cohort in cohorts.items():
            users = cohort["users"]
            if len(users) < self.min_shared_users:
                continue
            events = int(cohort["events"])
            results.append({
                "task_type": task,
                "weekday": weekday,
                "time_slot": slot,
                "distinct_users": len(users),
                "success_rate": round(int(cohort["successes"]) / events, 3) if events else 0.0,
                "contains_user_identifiers": False,
                "contains_raw_content": False,
            })
        return sorted(results, key=lambda item: (str(item["task_type"]), int(item["weekday"]), int(item["time_slot"])))

    def forget_user(self, user_id: str) -> Dict[str, object]:
        """Remove all in-memory observations for one user, including shareable events."""
        existed = self._observations.pop(user_id, None) is not None
        return {"status": "FORGOTTEN" if existed else "NOT_FOUND", "user_data_removed": existed}

    def user_summary(self, user_id: str) -> Dict[str, object]:
        observations = self._observations.get(user_id, [])
        return {
            "observation_count": len(observations),
            "shared_observation_count": sum(item.share_consent for item in observations),
            "raw_content_stored": False,
        }
