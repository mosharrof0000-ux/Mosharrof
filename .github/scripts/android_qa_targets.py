"""Fresh Android WebView target discovery for reproducible CDP diagnostics."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.request import urlopen


def fetch_webview_targets(endpoint: str, snapshot_path: Path) -> list[dict]:
    """Refresh the target list before connecting; preserve the first snapshot for comparison."""
    snapshot_path = Path(snapshot_path)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    initial_snapshot = snapshot_path.with_name("webview-targets-initial.json")
    if snapshot_path.is_file() and not initial_snapshot.exists():
        initial_snapshot.write_text(snapshot_path.read_text(encoding="utf-8"), encoding="utf-8")

    target_url = endpoint.rstrip("/") + "/json/list"
    with urlopen(target_url, timeout=10) as response:
        targets = json.load(response)
    if not isinstance(targets, list):
        raise ValueError("WebView target endpoint returned a non-list payload")

    snapshot_path.write_text(
        json.dumps(targets, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return targets
