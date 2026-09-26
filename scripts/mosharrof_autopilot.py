#!/usr/bin/env python3
"""Mosharrof guarded autopilot planner.

The workflow supplies an issue task and a bounded snapshot of project files.
Gemini returns JSON describing file replacements. This script never deletes files,
never edits .github/workflows, and never targets main.
"""
import json, os, sys, urllib.request

task=os.environ.get("MOSHARROF_TASK","").strip()
snapshot=os.environ.get("MOSHARROF_SNAPSHOT","")
api=os.environ.get("GEMINI_API_KEY","").strip()
model=os.environ.get("GEMINI_MODEL","gemini-3.6-flash").strip()
if not task or not api:
    raise SystemExit("Autopilot requires MOSHARROF_TASK and GEMINI_API_KEY")

prompt=f"""You are Mosharrof's guarded software agent.
Task:
{task}

Repository rules:
- Work only on the current isolated feature branch.
- Never propose deletion.
- Never modify .github/workflows, secrets, permissions, branch protection, or deployment rules.
- Prefer the smallest safe change.
- Preserve existing functionality.
- Return JSON only with: summary (string), files (array of objects with path and content).
- Allowed paths: web/, tests/, scripts/, docs/, README.md, requirements.txt.
- Each file object replaces the complete file. Include only files that must change.
- If the task cannot be safely completed from the supplied snapshot, return files: [] and explain in summary.

Current project snapshot:
{snapshot}
"""
body={"contents":[{"parts":[{"text":prompt}]}],
      "generationConfig":{"responseMimeType":"application/json"}}
req=urllib.request.Request(
    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    data=json.dumps(body).encode(),
    headers={"Content-Type":"application/json","x-goog-api-key":api},
    method="POST")
with urllib.request.urlopen(req,timeout=180) as r:
    data=json.load(r)
text=data["candidates"][0]["content"]["parts"][0]["text"]
result=json.loads(text)
if not isinstance(result,dict) or not isinstance(result.get("files"),list):
    raise SystemExit("Invalid agent response")
print(json.dumps(result,ensure_ascii=False))
