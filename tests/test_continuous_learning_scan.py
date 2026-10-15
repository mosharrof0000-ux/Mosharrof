import json
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.continuous_learning_scan import build_report, parse_feed, validate_feed


class ContinuousLearningScanTests(unittest.TestCase):
    def test_rejects_non_https_and_unapproved_hosts(self):
        base = {"id": "test", "domain": "ai-models", "provider": "Test"}
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            validate_feed({**base, "url": "http://openai.com/feed"})
        with self.assertRaisesRegex(ValueError, "allowlist"):
            validate_feed({**base, "url": "https://evil.example/feed"})
        with self.assertRaisesRegex(ValueError, "credentials"):
            validate_feed({**base, "url": "https://user:pass@openai.com/feed"})

    def test_parses_rss_and_limits_items(self):
        payload = b"""<?xml version="1.0"?><rss><channel>
        <item><title>One</title><link>https://openai.com/one</link><description>Summary</description><pubDate>2026-10-01</pubDate></item>
        <item><title>Two</title><link>https://openai.com/two</link></item>
        </channel></rss>"""
        feed = {"id": "openai-news", "provider": "OpenAI", "domain": "ai-models"}
        result = parse_feed(payload, feed, "2026-10-15T00:00:00+00:00")
        self.assertEqual(len(result["items"]), 2)
        self.assertEqual(result["items"][0]["title"], "One")
        self.assertEqual(result["items"][0]["reliability"], "source-origin-only-not-independently-verified")

    def test_invalid_item_links_are_not_kept(self):
        payload = b"""<rss><channel><item><title>Bad link</title><link>http://example.com/a</link></item></channel></rss>"""
        result = parse_feed(payload, {"id": "test", "provider": "Test", "domain": "research"}, "2026-10-15T00:00:00+00:00")
        self.assertEqual(result["items"][0]["url"], "")

    def test_report_is_read_only_and_reports_coverage_gaps(self):
        config = {
            "feeds": [],
            "coverage_gaps": [{"provider": "xAI Grok", "status": "needs-verified-official-feed"}],
        }
        report = build_report(config, "2026-10-15T00:00:00+00:00")
        self.assertFalse(report["live_mutation"])
        self.assertFalse(report["secret_access"])
        self.assertEqual(report["coverage_gaps"][0]["provider"], "xAI Grok")
        self.assertEqual(report["mode"], "read-only-report")

    def test_configured_feeds_are_within_size_and_exact_host_allowlist(self):
        config = json.loads((Path(__file__).resolve().parents[1] / "organs/continuous-learning-orchestrator/sources.json").read_text())
        self.assertLessEqual(len(config["feeds"]), 20)
        for feed in config["feeds"]:
            self.assertTrue(validate_feed(feed).startswith("https://"))


if __name__ == "__main__":
    unittest.main()
