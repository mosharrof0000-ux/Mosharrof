import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DeviceControlFrontendContractTests(unittest.TestCase):
    def test_native_bridge_requires_a_second_explicit_confirmation(self):
        source = (ROOT / "android-src" / "MosharrofDeviceControlPlugin.java").read_text(encoding="utf-8")
        self.assertIn("private void confirm(", source)
        self.assertGreaterEqual(source.count("confirm(call,"), 6)
        self.assertIn('.setPositiveButton("অনুমতি দিন"', source)
        self.assertIn('.setNegativeButton("বাতিল"', source)
        self.assertIn("Intent.ACTION_DIAL", source)
        self.assertNotIn("Intent.ACTION_CALL", source)
        self.assertIn("no message was sent", source)
        self.assertIn("no email was sent", source)
        self.assertIn('new File(getContext().getFilesDir(), "device-action-audit.jsonl")', source)
        self.assertIn('writeAudit(actionName, "APPROVED_FOR_EXECUTION")', source)
        self.assertIn('call.reject("AUDIT_UNAVAILABLE_BEFORE_ACTION")', source)

    def test_apk_workflow_registers_native_plugin_and_checks_javascript(self):
        workflow = (ROOT / ".github" / "workflows" / "build-apk.yml").read_text(encoding="utf-8")
        self.assertIn("node --check web/device-control.js", workflow)
        self.assertIn("cp android-src/MosharrofDeviceControlPlugin.java", workflow)
        self.assertIn("registerPlugin(MosharrofDeviceControlPlugin.class)", workflow)
        self.assertIn("<queries>", workflow)

    def test_frontend_loads_device_control_module_and_styles(self):
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="./device-control.js"', html)
        self.assertIn('href="./device-control.css"', html)
        self.assertIn("window.MosharrofDeviceControl.parse(text)", html)

    def test_frontend_intercepts_only_supported_explicit_commands(self):
        if not shutil.which("node"):
            self.skipTest("Node.js is unavailable in this test environment")
        script = r"""
          global.window = {};
          require('./web/device-control.js');
          const api = window.MosharrofDeviceControl;
          const cases = {
            settings: api.parse('সেটিংস খোলো Wi-Fi'),
            prefixedSettings: api.parse('Wi-Fi সেটিংস খোলো'),
            dial: api.parse('কল করো 01712345678'),
            sms: api.parse('মেসেজ লিখো 01712345678: আমি পরে ফোন করব'),
            email: api.parse('ইমেইল লিখো test@example.com: রিপোর্ট দেখুন'),
            file: api.parse('ফাইল বাছাই করো'),
            ordinary: api.parse('বাংলাদেশের ইতিহাস বলুন')
          };
          process.stdout.write(JSON.stringify(cases));
        """
        result = subprocess.run(
            ["node", "-e", script], cwd=ROOT, text=True,
            capture_output=True, check=True, timeout=10
        )
        parsed = json.loads(result.stdout)
        self.assertEqual(parsed["settings"]["payload"]["page"], "wifi")
        self.assertEqual(parsed["prefixedSettings"]["payload"]["page"], "wifi")
        self.assertEqual(parsed["dial"]["kind"], "dial")
        self.assertEqual(parsed["sms"]["kind"], "sms")
        self.assertEqual(parsed["email"]["kind"], "email")
        self.assertEqual(parsed["file"]["kind"], "file")
        self.assertIsNone(parsed["ordinary"])


if __name__ == "__main__":
    unittest.main()
