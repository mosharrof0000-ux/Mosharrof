import unittest

from scripts.automation.autonomous_patch_quality import is_trivial_rewrite


class AutonomousPatchQualityTests(unittest.TestCase):
    def test_ignores_missing_terminal_newline_only(self):
        self.assertTrue(is_trivial_rewrite("same content\\n", "same content"))

    def test_ignores_extra_terminal_newlines_only(self):
        self.assertTrue(is_trivial_rewrite("same content\\n", "same content\\n\\n"))

    def test_keeps_substantive_content_changes(self):
        self.assertFalse(is_trivial_rewrite("old content\\n", "new content\\n"))

    def test_keeps_internal_newline_changes(self):
        self.assertFalse(is_trivial_rewrite("first\\nsecond\\n", "first second\\n"))


if __name__ == "__main__":
    unittest.main()
