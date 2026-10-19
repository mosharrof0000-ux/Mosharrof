import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "automation" / "work_engine.py"


class WorkEngineTests(unittest.TestCase):
    def run_engine(self, phase, out_dir, event_path, summary_path, status="success"):
        env = dict(os.environ)
        env.update({
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_EVENT_PATH": str(event_path),
            "GITHUB_WORKFLOW": "Test Work Engine",
            "GITHUB_RUN_ID": "12345",
            "GITHUB_REPOSITORY": "mosharrof0000-ux/Mosharrof",
            "GITHUB_REF_NAME": "feature/test",
            "GITHUB_SHA": "abc123",
            "GITHUB_SERVER_URL": "https://github.com",
            "GITHUB_STEP_SUMMARY": str(summary_path),
            "ENGINE_JOB_STATUS": status,
        })
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--phase", phase, "--out-dir", str(out_dir)],
            env=env, capture_output=True, text=True, check=True,
        )

    def test_start_records_plan_and_source_sha(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            event = root / "event.json"
            event.write_text(json.dumps({"head_commit": {"message": "add feature"}}), encoding="utf-8")
            out = root / "out"
            summary = root / "summary.md"
            self.run_engine("start", out, event, summary)
            state = json.loads((out / "state.json").read_text(encoding="utf-8"))
            log = (out / "entry.md").read_text(encoding="utf-8")
            self.assertEqual(state["sha"], "abc123")
            self.assertEqual(state["status"], "in_progress")
            self.assertIn("Planned work", log)
            self.assertIn("Checked before work", log)
            self.assertIn("STARTED", summary.read_text(encoding="utf-8"))

    def test_finish_updates_outcome_and_resume_point(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            event = root / "event.json"
            event.write_text(json.dumps({"head_commit": {"message": "add feature"}}), encoding="utf-8")
            out = root / "out"
            summary = root / "summary.md"
            self.run_engine("start", out, event, summary)
            self.run_engine("finish", out, event, summary, status="failure")
            state = json.loads((out / "state.json").read_text(encoding="utf-8"))
            log = (out / "entry.md").read_text(encoding="utf-8")
            self.assertEqual(state["outcome"], "failure")
            self.assertIn("Inspect this work-engine run's logs", state["next_step"])
            self.assertIn("FINISHED", log)
            self.assertIn("FAILURE", log)
            self.assertIn("FINISHED", summary.read_text(encoding="utf-8"))

    def test_workflow_run_keeps_recorder_and_source_run_ids_separate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            event = root / "event.json"
            event.write_text(json.dumps({
                "workflow_run": {
                    "id": 67890,
                    "html_url": "https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/67890",
                    "name": "Mosharrof Visual QA",
                    "head_branch": "feature/visual-check",
                    "head_sha": "source-sha",
                    "conclusion": "success",
                }
            }), encoding="utf-8")
            out = root / "out"
            summary = root / "summary.md"
            env = dict(os.environ)
            env.update({
                "GITHUB_EVENT_NAME": "workflow_run",
                "GITHUB_EVENT_PATH": str(event),
                "GITHUB_WORKFLOW": "MOSHARROF Automatic Work Engine",
                "GITHUB_RUN_ID": "12345",
                "GITHUB_REPOSITORY": "mosharrof0000-ux/Mosharrof",
                "GITHUB_REF_NAME": "main",
                "GITHUB_SHA": "recorder-sha",
                "GITHUB_SERVER_URL": "https://github.com",
                "GITHUB_STEP_SUMMARY": str(summary),
            })
            subprocess.run(
                [sys.executable, str(SCRIPT), "--phase", "start", "--out-dir", str(out)],
                env=env, capture_output=True, text=True, check=True,
            )
            state = json.loads((out / "state.json").read_text(encoding="utf-8"))
            self.assertEqual(state["run_id"], "12345")
            self.assertEqual(state["run_url"], "https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/12345")
            self.assertEqual(state["source_run_id"], "67890")
            self.assertEqual(state["source_run_url"], "https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/67890")
            self.assertEqual(state["source_conclusion"], "success")


    def test_workflow_run_recorder_is_limited_to_main_release_runs(self):
        workflow = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "automatic-work-engine.yml"
        content = workflow.read_text(encoding="utf-8")
        self.assertIn("github.event.workflow_run.head_branch == 'main'", content)


if __name__ == "__main__":
    unittest.main()

def test_android_apk_chat_probe_is_valid_python():
    import ast
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    relative = "scripts/android/apk_chat_smoke.py"
    ast.parse((root / relative).read_text(encoding="utf-8"), filename=relative)

