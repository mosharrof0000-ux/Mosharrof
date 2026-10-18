import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch, Mock

MODULE_PATH = pathlib.Path(__file__).resolve().parents[1] / ".github" / "scripts" / "automation_resilience.py"
SPEC = importlib.util.spec_from_file_location("automation_resilience", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class AutomationResilienceTests(unittest.TestCase):
    def test_bounded_json_remains_valid_and_reports_truncation(self):
        items = [{"number": i, "title": "x" * 100} for i in range(20)]
        encoded = MODULE.bounded_json(items, limit=350)
        parsed = json.loads(encoded)
        self.assertLess(len(encoded), 350)
        self.assertEqual(parsed["truncated"], len(items) - len(parsed["items"]))
        self.assertGreater(parsed["truncated"], 0)

    @patch.object(MODULE.time, "sleep")
    @patch.object(MODULE.subprocess, "run")
    def test_gh_json_retries_then_returns_valid_data(self, run, sleep):
        run.side_effect = [
            Mock(returncode=1, stdout="", stderr="temporary API error"),
            Mock(returncode=0, stdout='[{"number": 7}]', stderr=""),
        ]
        result = MODULE.gh_json(["issue", "list"], "owner/repo")
        self.assertEqual(result, [{"number": 7}])
        self.assertEqual(run.call_count, 2)
        sleep.assert_called_once_with(1)

    @patch.object(MODULE.time, "sleep")
    @patch.object(MODULE.subprocess, "run")
    def test_gh_json_fails_loudly_after_retries(self, run, sleep):
        run.return_value = Mock(returncode=1, stdout="", stderr="permission denied")
        with self.assertRaisesRegex(SystemExit, "Cannot build a trustworthy backlog"):
            MODULE.gh_json(["pr", "list"], "owner/repo", attempts=3)
        self.assertEqual(run.call_count, 3)
        self.assertEqual(sleep.call_count, 2)


if __name__ == "__main__":
    unittest.main()
