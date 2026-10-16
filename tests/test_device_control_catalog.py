import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "config" / "device_control_catalog.json"
DOC_PATH = ROOT / "docs" / "MASTER_DEVICE_CONTROL_CATALOG.md"


class DeviceControlCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_has_unique_capability_ids(self):
        capabilities = self.catalog["capabilities"]
        ids = [item["id"] for item in capabilities]
        self.assertTrue(ids)
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_action_requires_per_action_approval(self):
        for capability in self.catalog["capabilities"]:
            with self.subTest(capability=capability["id"]):
                self.assertEqual(capability["approval"], "every_action")
                self.assertTrue(capability["actions"])

    def test_global_destructive_operations_remain_blocked(self):
        policy = self.catalog["policy"]
        self.assertFalse(policy["delete_allowed"])
        self.assertFalse(policy["destructive_operations_allowed"])
        delete_capability = next(
            item for item in self.catalog["capabilities"] if item["id"] == "files.delete"
        )
        self.assertEqual(delete_capability["status"], "blocked_by_platform_provider")
        self.assertIn("DELETE and destructive operations are blocked by global policy",
                      delete_capability["limits"])

    def test_result_verification_and_truthful_reporting_are_required(self):
        policy = self.catalog["policy"]
        self.assertTrue(policy["verify_result"])
        self.assertFalse(policy["report_unverified_as_success"])
        self.assertTrue(policy["check_permission_at_point_of_use"])

    def test_no_broad_access_or_secret_logging_by_default(self):
        policy = self.catalog["policy"]
        self.assertFalse(policy["broad_access_by_default"])
        self.assertFalse(policy["secrets_in_client_or_logs"])
        self.assertTrue(policy["least_privilege"])

    def test_partial_catalog_does_not_claim_all_device_actions_are_verified(self):
        self.assertEqual(self.catalog["status"], "partial")
        self.assertIn("implementation_summary", self.catalog)
        self.assertNotIn("verified", self.catalog["implementation_summary"]["status"])
        for capability in self.catalog["capabilities"]:
            if capability.get("implemented_actions"):
                self.assertEqual(capability["status"], "partial")

    def test_only_current_main_device_info_and_settings_are_marked_implemented(self):
        summary = self.catalog["implementation_summary"]
        self.assertEqual(summary["implemented_capabilities"], ["device.info", "settings.open_page"])
        implemented = {item["id"] for item in self.catalog["capabilities"] if item.get("implemented_actions")}
        self.assertEqual(implemented, {"device.info", "settings.open_page"})

    def test_documented_safety_and_release_gates_exist(self):
        text = DOC_PATH.read_text(encoding="utf-8")
        for phrase in (
            "Non-negotiable execution contract",
            "DELETE and destructive operations",
            "Required test matrix",
            "Release gates",
            "no direct edits",
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase.lower(), text.lower())


if __name__ == "__main__":
    unittest.main()
