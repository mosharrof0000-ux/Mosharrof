import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "automation" / "work_engine.py"


class WorkEngineRecoveryTests(unittest.TestCase):
    def test_finish_without_start_creates_recovery_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            event = root / "event.json"
            event.write_text(json.dumps({"head_commit": {"message": "start failed"}}), encoding="utf-8")
            out = root / "out"
            summary = root / "summary.md"
            env = dict(os.environ)
            env.update({
                "GITHUB_EVENT_NAME": "push",
                "GITHUB_EVENT_PATH": str(event),
                "GITHUB_WORKFLOW": "Test Work Engine Recovery",
                "GITHUB_RUN_ID": "12345",
                "GITHUB_REPOSITORY": "mosharrof0000-ux/Mosharrof",
                "GITHUB_REF_NAME": "feature/test",
                "GITHUB_SHA": "abc123",
                "GITHUB_SERVER_URL": "https://github.com",
                "GITHUB_STEP_SUMMARY": str(summary),
                "ENGINE_JOB_STATUS": "failure",
            })
            subprocess.run(
                [sys.executable, str(SCRIPT), "--phase", "finish", "--out-dir", str(out)],
                env=env, capture_output=True, text=True, check=True,
            )
            state = json.loads((out / "state.json").read_text(encoding="utf-8"))
            self.assertTrue(state.get("timestamp_utc"))
            self.assertEqual(state["phase"], "FINISHED")
            self.assertEqual(state["outcome"], "failure")
            self.assertIn("Resume from the last durable gate checkpoint", state["next_step"])


if __name__ == "__main__":
    unittest.main()
