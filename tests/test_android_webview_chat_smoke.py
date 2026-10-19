import unittest
from pathlib import Path

class AndroidWebViewChatSmokeTests(unittest.TestCase):
    def test_webview_chat_smoke_test_exists(self):
        # Verify the smoke test script exists in the PR #748 branch context
        script = Path("scripts/android/webview_chat_smoke.py")
        self.assertTrue(script.exists(), "Smoke test script missing")

    def test_smoke_test_uses_safe_webview_bridge(self):
        script = Path("scripts/android/webview_chat_smoke.py").read_text(encoding="utf-8")
        self.assertIn("WebView", script)
        self.assertIn("evaluateJavascript", script)
        self.assertNotIn("eval(", script)

if __name__ == "__main__":
    unittest.main()