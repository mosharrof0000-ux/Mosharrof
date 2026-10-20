import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "scripts" / "validate_action_contributions.py"
SPEC = importlib.util.spec_from_file_location("validate_action_contributions", VALIDATOR)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ActionContributionRegistryTests(unittest.TestCase):
    def test_registry_contract_is_valid(self):
        groups, contributions = MODULE.validate()
        self.assertEqual(groups, 1)
        self.assertGreaterEqual(contributions, 8)

    def test_existing_action_bar_is_the_only_registered_placement(self):
        import json
        manifest = json.loads((ROOT / "core/action-contributions/manifest.json").read_text(encoding="utf-8"))
        self.assertEqual({item["placement"] for item in manifest["contributions"]}, {"message_action_bar"})
        self.assertTrue(all(item["group_id"] == "message-actions" for item in manifest["contributions"]))

    def test_automatic_execution_fails_closed_until_policy_and_handler_exist(self):
        import json
        manifest = json.loads((ROOT / "core/action-contributions/manifest.json").read_text(encoding="utf-8"))
        for item in manifest["contributions"]:
            self.assertFalse(item["automatic_ready"])
            self.assertTrue(item["automatic_block_reason"])


if __name__ == "__main__":
    unittest.main()