import unittest
from unittest.mock import patch

from scripts import mosharrof_project_inventory as inventory


class ProjectInventoryTests(unittest.TestCase):
    def setUp(self):
        self.metadata = {
            "full_name": "mosharrof0000-ux/Mosharrof",
            "html_url": "https://github.com/mosharrof0000-ux/Mosharrof",
            "private": False,
            "default_branch": "main",
            "pushed_at": "2026-10-13T12:00:00Z",
        }
        self.commit = {
            "sha": "abc123",
            "html_url": "https://github.com/mosharrof0000-ux/Mosharrof/commit/abc123",
            "commit": {
                "message": "known-good commit\nextra detail",
                "committer": {"date": "2026-10-13T11:00:00Z"},
            },
        }
        self.pulls = [{
            "number": 584,
            "title": "Draft repair foundation",
            "html_url": "https://github.com/mosharrof0000-ux/Mosharrof/pull/584",
            "draft": True,
            "base": {"ref": "feat/chat-context-continuity"},
            "head": {"ref": "feat/project-self-repair-foundation", "sha": "def456"},
            "updated_at": "2026-10-13T12:30:00Z",
        }]
        self.runs = {"workflow_runs": [{
            "id": 1234, "name": "Mosharrof Tests", "event": "pull_request",
            "head_branch": "feature", "head_sha": "def456", "status": "completed",
            "conclusion": "success", "html_url": "https://github.com/example/run/1234",
            "created_at": "2026-10-13T12:00:00Z", "updated_at": "2026-10-13T12:01:00Z",
        }]}

    def fake_get(self, url):
        if url.rstrip("/").endswith("/repos/mosharrof0000-ux/Mosharrof"):
            return self.metadata, None
        if url.endswith("/commits/main"):
            return self.commit, None
        if "pulls?state=open" in url:
            return self.pulls, None
        if "actions/runs" in url:
            return self.runs, None
        return None, "HTTPError"

    def test_report_contains_verified_project_state_and_never_promotes(self):
        with patch.object(inventory, "_safe_get", side_effect=self.fake_get):
            report = inventory.build_inventory()

        self.assertEqual(report["repository"]["default_branch"], "main")
        self.assertEqual(report["default_branch_commit"]["sha"], "abc123")
        self.assertEqual(report["open_pull_requests"][0]["number"], 584)
        self.assertTrue(report["open_pull_requests"][0]["draft"])
        self.assertEqual(report["recent_workflow_runs"][0]["conclusion"], "success")
        self.assertEqual(report["mode"], "read_only")
        self.assertFalse(report["safety"]["writes_performed"])
        self.assertFalse(report["safety"]["deployment_performed"])
        self.assertFalse(report["safety"]["promotion_allowed"])
        self.assertEqual(report["warnings"], [])

    def test_unavailable_optional_sources_are_explicit_not_called_success(self):
        def partial(url):
            if url.rstrip("/").endswith("/repos/mosharrof0000-ux/Mosharrof"):
                return self.metadata, None
            if url.endswith("/commits/main"):
                return self.commit, None
            return None, "HTTPError"

        with patch.object(inventory, "_safe_get", side_effect=partial):
            report = inventory.build_inventory()

        self.assertIsNone(report["open_pull_requests"])
        self.assertIsNone(report["recent_workflow_runs"])
        self.assertIn("open_pull_requests_unavailable", report["warnings"])
        self.assertIn("workflow_runs_unavailable", report["warnings"])

    def test_repository_format_is_validated_before_network_access(self):
        with patch.object(inventory, "_safe_get") as get:
            with self.assertRaises(ValueError):
                inventory.build_inventory("not-a-repo")
        get.assert_not_called()

    def test_metadata_failure_stops_instead_of_inventing_state(self):
        with patch.object(inventory, "_safe_get", return_value=(None, "HTTPError")):
            with self.assertRaises(inventory.InventoryError):
                inventory.build_inventory()

    def test_health_url_must_be_https(self):
        with patch.object(inventory, "_safe_get", side_effect=self.fake_get):
            report = inventory.build_inventory(health_url="http://example.com")
        self.assertEqual(report["health_check"]["status"], "rejected_non_https_url")
        self.assertIn("health_check_url_rejected", report["warnings"])


    def test_inventory_workflow_is_manual_and_read_only(self):
        from pathlib import Path

        workflow = Path(".github/workflows/project-inventory.yml").read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("contents: read", workflow)
        self.assertIn("pull-requests: read", workflow)
        self.assertIn("actions: read", workflow)
        self.assertIn("GITHUB_TOKEN: ${{ github.token }}", workflow)
        self.assertNotIn("\n  push:", workflow)
        self.assertNotIn("\n  pull_request:", workflow)
        self.assertIn("actions/upload-artifact@v4", workflow)
        self.assertIn("retention-days: 14", workflow)

if __name__ == "__main__":
    unittest.main()
