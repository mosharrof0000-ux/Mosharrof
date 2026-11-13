import tempfile
import unittest
from pathlib import Path

from scripts.automation_recovery.supervisor import (
    AIIncidentAdvisor, Checkpoint, Incident, RuleBasedAdvisor, Supervisor,
    load_checkpoint, save_checkpoint,
)


class SupervisorTests(unittest.TestCase):
    def test_healthy_resets_retry_counter(self):
        supervisor = Supervisor(lambda: True, max_restarts=2, backoff_seconds=0, clock=lambda: 100.0)
        self.assertEqual(supervisor.tick(False)["status"], "restart_requested")
        self.assertEqual(supervisor.tick(True)["status"], "healthy")
        self.assertEqual(supervisor.attempts, 0)

    def test_retries_are_bounded(self):
        supervisor = Supervisor(lambda: False, max_restarts=1, backoff_seconds=0, clock=lambda: 100.0)
        self.assertEqual(supervisor.tick(False)["status"], "restart_failed")
        self.assertEqual(supervisor.tick(False)["status"], "manual_intervention_required")

    def test_backoff_prevents_hot_loop(self):
        now = [100.0]
        supervisor = Supervisor(lambda: True, max_restarts=3, backoff_seconds=30, clock=lambda: now[0])
        supervisor.tick(False)
        self.assertEqual(supervisor.tick(False)["status"], "backoff")
        now[0] += 30
        self.assertEqual(supervisor.tick(False)["status"], "restart_requested")

    def test_checkpoint_round_trip_and_corrupt_state(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "checkpoint.json"
            checkpoint = Checkpoint("task-1", "test", {"done": ["a"]}, 123.0)
            save_checkpoint(path, checkpoint)
            self.assertEqual(load_checkpoint(path), checkpoint)
            path.write_text("{broken", encoding="utf-8")
            self.assertIsNone(load_checkpoint(path))

    def test_ai_adapter_is_honest_when_not_configured(self):
        advice = AIIncidentAdvisor().diagnose(Incident("worker", "HTTP 503", 0, 1.0))
        self.assertIn("AI_NOT_CONFIGURED", advice)
        self.assertIn("transient_network_or_service", advice)

    def test_configured_ai_callback_receives_redacted_compact_summary(self):
        captured = []
        def fake_model_call(summary):
            captured.append(summary)
            return "Check upstream service health."
        advisor = AIIncidentAdvisor(model_call=fake_model_call)
        advice = advisor.diagnose(Incident("worker", "api_key=super-secret-token HTTP 503", 2, 1.0))
        self.assertIn("ai_advice_unverified", advice)
        self.assertIn("Check upstream service health.", advice)
        self.assertEqual(len(captured), 1)
        self.assertNotIn("super-secret-token", captured[0])
        self.assertIn("[REDACTED]", captured[0])
        self.assertIn('"attempt": 2', captured[0])

    def test_ai_callback_failure_falls_back_safely(self):
        def broken_model_call(_summary):
            raise RuntimeError("provider unavailable")
        advice = AIIncidentAdvisor(model_call=broken_model_call).diagnose(
            Incident("worker", "HTTP 503", 0, 1.0)
        )
        self.assertIn("AI_CALL_FAILED", advice)
        self.assertIn("transient_network_or_service", advice)

    def test_rule_advisor_classifies_permission_and_quota(self):
        advisor = RuleBasedAdvisor()
        self.assertIn("permission_or_auth", advisor.diagnose(Incident("error", "403 forbidden", 0, 1)))
        self.assertIn("rate_limited", advisor.diagnose(Incident("error", "429 quota", 0, 1)))


if __name__ == "__main__":
    unittest.main()
