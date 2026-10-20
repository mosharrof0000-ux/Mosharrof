import unittest

from src.core.task_coordinator import TaskCoordinator


class TaskCoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.coordinator = TaskCoordinator()
        self.task_args = {
            "capability": "video.create",
            "entity_id": "video-maker",
            "resource_scope": "video/projects/demo",
            "entity_scope": "video/*",
            "granted_permissions": ["video.create"],
            "policy_ok": True,
            "provider_ready": True,
            "requires_approval": True,
            "summary": "Create a draft video",
        }

    def test_high_impact_task_waits_for_approval_and_does_not_start(self):
        task = self.coordinator.create_task(**self.task_args, task_id="approval")
        self.assertEqual(task["state"], "AWAITING_APPROVAL")
        result = self.coordinator.authorize_task("approval")
        self.assertEqual(result["state"], "AWAITING_APPROVAL")
        self.assertEqual(result["decision"]["reason"], "USER_APPROVAL_REQUIRED")

    def test_approved_task_must_pass_permission_gate_before_running(self):
        self.coordinator.create_task(**self.task_args, task_id="approved")
        approved = self.coordinator.approve_task("approved", approved=True)
        self.assertEqual(approved["state"], "RECEIVED")
        ready = self.coordinator.authorize_task("approved")
        self.assertEqual(ready["state"], "READY")
        self.assertEqual(ready["decision"]["status"], "ALLOWED")
        running = self.coordinator.mark_running("approved")
        self.assertEqual(running["state"], "RUNNING")
        done = self.coordinator.finish_task(
            "approved", succeeded=True, result_summary="Draft created"
        )
        self.assertEqual(done["state"], "SUCCEEDED")
        self.assertEqual(done["result_summary"], "Draft created")

    def test_rejected_task_is_terminal_and_cannot_be_authorized(self):
        self.coordinator.create_task(**self.task_args, task_id="rejected")
        rejected = self.coordinator.approve_task("rejected", approved=False)
        self.assertEqual(rejected["state"], "DENIED")
        with self.assertRaises(ValueError):
            self.coordinator.authorize_task("rejected")

    def test_missing_provider_fails_closed(self):
        args = {**self.task_args, "provider_ready": False, "requires_approval": False}
        self.coordinator.create_task(**args, task_id="no-provider")
        result = self.coordinator.authorize_task("no-provider")
        self.assertEqual(result["state"], "DENIED")
        self.assertEqual(result["decision"]["reason"], "PROVIDER_NOT_READY")

    def test_unknown_capability_fails_closed(self):
        args = {**self.task_args, "capability": "device.silently_take_over"}
        self.coordinator.create_task(**args, task_id="unknown")
        self.coordinator.approve_task("unknown", approved=True)
        result = self.coordinator.authorize_task("unknown")
        self.assertEqual(result["state"], "DENIED")
        self.assertEqual(result["decision"]["reason"], "UNKNOWN_CAPABILITY")

    def test_permanently_blocked_capability_fails_closed(self):
        args = {**self.task_args, "capability": "video.delete", "granted_permissions": ["video.*"]}
        self.coordinator.create_task(**args, task_id="delete-task")
        self.coordinator.approve_task("delete-task", approved=True)
        result = self.coordinator.authorize_task("delete-task")
        self.assertEqual(result["state"], "DENIED")
        self.assertEqual(result["decision"]["reason"], "PERMANENT_SAFETY_BLOCK")

    def test_only_authorized_tasks_can_be_marked_running(self):
        self.coordinator.create_task(**self.task_args, task_id="not-ready")
        with self.assertRaises(ValueError):
            self.coordinator.mark_running("not-ready")

    def test_task_records_are_returned_as_copies(self):
        task = self.coordinator.create_task(**self.task_args, task_id="copy")
        task["state"] = "TAMPERED"
        self.assertEqual(self.coordinator.get_task("copy")["state"], "AWAITING_APPROVAL")

    def test_task_id_must_be_unique(self):
        self.coordinator.create_task(**self.task_args, task_id="duplicate")
        with self.assertRaises(ValueError):
            self.coordinator.create_task(**self.task_args, task_id="duplicate")


if __name__ == "__main__":
    unittest.main()
