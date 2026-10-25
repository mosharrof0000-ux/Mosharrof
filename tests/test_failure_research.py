import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "automation" / "failure_research.py"
SPEC = importlib.util.spec_from_file_location("failure_research", SCRIPT)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

class FailureResearchTests(unittest.TestCase):
    def test_extracts_distinct_failure_signatures(self):
        log = "INFO booting\nE: adb: device offline\nE: adb: device offline\nTimeout waiting for emulator"
        self.assertEqual(module.signatures(log), ["E: adb: device offline", "Timeout waiting for emulator"])

    def test_redacts_tokens_before_search(self):
        log = "ERROR request failed api_key=supersecretvalue"
        sig = module.signatures(log)[0]
        self.assertNotIn("supersecretvalue", sig)
        self.assertIn("[REDACTED]", sig)

    def test_redacts_secrets_in_url_query_parameters(self):
        value = module.redact("ERROR https://example.test/api?access_token=privatevalue&mode=chat failed")
        self.assertNotIn("privatevalue", value)
        self.assertIn("[REDACTED]", value)

    def test_report_contains_multiple_search_sources_and_safety_note(self):
        original = module.search_sources
        module.search_sources = lambda sig, token: {
            "signature": sig,
            "search_links": {"Google": "https://www.google.com/search?q=x", "Bing": "https://www.bing.com/search?q=x"},
            "github_issues": [], "stackoverflow": [], "github_api_available": True, "stackoverflow_api_available": True
        }
        try:
            report = module.build_report("ERROR: Broken pipe (32)", "https://github.com/example/repo/actions/runs/1", "QA")
        finally:
            module.search_sources = original
        self.assertIn("Google", report)
        self.assertIn("Bing", report)
        self.assertIn("logs are not attached", report)
        self.assertIn("Broken pipe", report)

if __name__ == "__main__":
    unittest.main()
