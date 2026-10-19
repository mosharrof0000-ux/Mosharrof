import unittest
from pathlib import Path

class AndroidApkWebViewChatTests(unittest.TestCase):
    def test_apk_webview_chat_smoke_test_exists(self):
        # Verify the smoke test script for APK WebView chat exists
        script = Path("scripts/android/verify_apk_webview_chat.py")
        self.assertTrue(script.exists(), "APK WebView chat verification script missing")

    def test_apk_webview_chat_smoke_test_is_non_destructive(self):
        # Ensure the script is read-only/non-destructive
        content = Path("scripts/android/verify_apk_webview_chat.py").read_text(encoding="utf-8")
        self.assertNotIn("os.remove", content)
        self.assertNotIn("os.unlink", content)
        self.assertIn("verify_chat_response", content)

if __name__ == "__main__":
    unittest.main()