import json, os
from pathlib import Path


def pull_request_context():
    try:
        pr = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8")).get("pull_request") or {}
        return "\nPR intent (requested removals/reordering are intentional):\n" + str(pr.get("title") or "") + "\n" + str(pr.get("body") or "")[:5000] if pr else ""
    except (KeyError, OSError, ValueError, TypeError):
        return ""
