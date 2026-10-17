import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "automation" / "work_gate.py"

class WorkGateTests(unittest.TestCase):
    def call_gate(self, root, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *args, "--dir", str(root)],
                              capture_output=True, text=True)

    def test_enter_checkpoint_interrupt_and_resume_preserve_exact_step(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.assertEqual(self.call_gate(root, "enter", "--task", "QA", "--purpose", "test live flow", "--step", "open chat").returncode, 0)
            self.assertEqual(self.call_gate(root, "checkpoint", "--step", "open chat", "--details", "next: send test message").returncode, 0)
            self.assertEqual(self.call_gate(root, "interrupt", "--reason", "mobile_hang", "--step", "send test message", "--details", "emulator stopped responding").returncode, 0)
            state = json.loads((root / "gate-state.json").read_text())
            self.assertEqual(state["status"], "interrupted")
            self.assertEqual(state["interruption"]["reason"], "mobile_hang")
            self.assertEqual(state["resume_from"], "send test message")
            self.assertEqual(self.call_gate(root, "resume", "--details", "resume from saved step").returncode, 0)
            state = json.loads((root / "gate-state.json").read_text())
            self.assertEqual(state["status"], "in_progress")
            self.assertEqual(state["resume_from"], "send test message")
            event_rows = [json.loads(line) for line in (root / "gate-events.jsonl").read_text().splitlines()]
            self.assertEqual(len(event_rows), 4)
            self.assertTrue(all(row["task"] == "QA" for row in event_rows))
            self.assertTrue(all(row["purpose"] == "test live flow" for row in event_rows))

    def test_checkpoint_requires_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = self.call_gate(Path(tmp), "checkpoint", "--step", "test")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Run 'enter' first", result.stderr)

    def test_exit_marks_completed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.call_gate(root, "enter", "--step", "start")
            result = self.call_gate(root, "exit", "--step", "all checks", "--details", "green")
            self.assertEqual(result.returncode, 0)
            state = json.loads((root / "gate-state.json").read_text())
            self.assertEqual(state["status"], "completed")
            self.assertIn("all checks", state["completed_steps"])
            self.assertIsNone(state["resume_from"])

if __name__ == "__main__":
    unittest.main()
