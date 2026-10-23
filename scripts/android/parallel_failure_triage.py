#!/usr/bin/env python3
"""Evidence-only diagnostics for independent APK real-chat failure lanes."""
import argparse, json, re
from datetime import datetime, timezone
from pathlib import Path
LANES = {
 "artifact": (".github/workflows/android-apk-webview-real-chat-qa.yml .github/workflows/build-apk.yml", r"artifact|download|app-debug\.apk|headSha|run_id"),
 "emulator": ("scripts/android/run_apk_webview_smoke.sh", r"boot_completed|adb install|am start|emulator|INSTALL_FAILED"),
 "cdp": ("scripts/android/run_apk_webview_smoke.sh scripts/android/apk_webview_real_chat_smoke.py", r"webview_devtools_remote|json/list|webSocketDebuggerUrl|websocket"),
 "composer": ("scripts/android/apk_webview_real_chat_smoke.py web/index.html", r"#input|#sendBtn|synthetic_prompt_submitted|chat_composer_visible"),
 "backend": ("scripts/android/apk_webview_real_chat_smoke.py", r"real_backend_returned_non_mock_answer|failed to fetch|quota exceeded|timeout-ms|data-provider"),
 "evidence": (".github/workflows/android-apk-webview-real-chat-qa.yml scripts/android/apk_webview_real_chat_smoke.py scripts/android/run_apk_webview_smoke.sh", r"upload-artifact|report\.json|apk-webview-before\.png|apk-webview-after\.png")
}
p=argparse.ArgumentParser()
p.add_argument("--lane",choices=sorted(LANES),required=True)
p.add_argument("--log",default="artifacts/failure.log")
p.add_argument("--output",default="artifacts/triage")
p.add_argument("--run-id",default="")
p.add_argument("--run-url",default="")
p.add_argument("--source-root",default=".")
a=p.parse_args()
root=Path(a.source_root)
files, pattern=LANES[a.lane]
checks=[]
for name in files.split():
 path=root/name; exists=path.is_file()
 found=bool(re.search(pattern,path.read_text(encoding="utf-8",errors="replace"),re.I)) if exists else False
 checks.append({"file":name,"exists":exists,"pattern_found":found})
log_path=Path(a.log)
log=log_path.read_text(encoding="utf-8",errors="replace") if log_path.exists() else ""
matches=[line.strip()[:400] for line in log.splitlines() if re.search(pattern,line,re.I)]
out=Path(a.output); out.mkdir(parents=True,exist_ok=True)
report={"schema_version":1,"lane":a.lane,"timestamp_utc":datetime.now(timezone.utc).isoformat(),"run_id":a.run_id,"run_url":a.run_url,"source_root":str(root),"diagnostic_only":True,"fix_applied":False,"log_available":bool(log),"source_checks":checks,"log_matches":matches[:40],"interpretation":"Matches are leads, not proof of root cause. Inspect full logs and rerun the real end-to-end acceptance test after a fix."}
(out/(a.lane+".json")).write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
lines=["Parallel failure triage: "+a.lane,"","Run: "+(a.run_url or a.run_id or "not supplied"),"Source revision: "+str(root),"Log available: "+str(bool(log)),"Fix applied: no","","Source checks"]
lines += [("PASS" if c["exists"] and c["pattern_found"] else "REVIEW")+" - "+c["file"]+" (exists="+str(c["exists"])+", expected pattern="+str(c["pattern_found"])+")" for c in checks]
lines += ["","Matching log lines"] + (matches[:30] if matches else ["No lane-specific pattern found; inspect the complete run log."])
lines += ["","Interpretation",report["interpretation"],""]
(out/(a.lane+".md")).write_text("\n".join(lines),encoding="utf-8")
print("lane="+a.lane+" log_available="+str(bool(log))+" matches="+str(len(matches))+" checks="+str(len(checks)))
