import unittest
from pathlib import Path

class FoundationSizeGateSplitTests(unittest.TestCase):
    def test_permission_profile_test_split_is_valid(self):
        # Verify the split logic for foundation permission-profile tests
        # to ensure it correctly unblocks the Pages size gate.
        foundation_tests = Path("tests/test_foundation.py").read_text(encoding="utf-8")
        self.assertIn("test_manifest_and_registry_are_valid", foundation_tests)
        self.assertIn("test_all_entities_have_valid_scope_format", foundation_tests)
        # The split should move permission-specific tests to a dedicated file
        # while keeping foundation integrity.
        self.assertTrue(Path("tests/test_permission_profiles.py").exists())
