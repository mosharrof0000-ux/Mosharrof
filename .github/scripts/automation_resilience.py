"""Small reliability helpers for the scheduled MOSHARROF backlog worker."""
import json
import subprocess
import time


def gh_json(args, repo, attempts=3):
    """Retry GitHub CLI/API errors and fail visibly rather than losing backlog data."""
    last_error = "unknown error"
    for attempt in range(attempts):
        try:
            result = subprocess.run(
                ["gh", *args, "--repo", repo],
                capture_output=True, text=True, timeout=30, check=False,
            )
            if result.returncode == 0:
                try:
                    return json.loads(result.stdout or "[]")
                except json.JSONDecodeError as exc:
                    last_error = f"invalid JSON: {exc}"
            else:
                detail = (result.stderr or result.stdout or "no diagnostic").strip()
                last_error = f"gh exited {result.returncode}: {detail[:500]}"
        except (OSError, subprocess.TimeoutExpired) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            delay = 2 ** attempt
            print(f"GitHub backlog query failed ({last_error}); retrying in {delay}s.")
            time.sleep(delay)
    raise SystemExit(f"Cannot build a trustworthy backlog: {last_error}")


def bounded_json(items, limit=3600):
    """Keep complete JSON records within a prompt budget; never cut JSON mid-record."""
    if not isinstance(items, list):
        items = []
    kept = []
    for item in items:
        candidate = kept + [item]
        if len(json.dumps({"items": candidate, "truncated": len(items) - len(candidate)}, ensure_ascii=False)) > limit:
            break
        kept.append(item)
    return json.dumps({"items": kept, "truncated": max(0, len(items) - len(kept))}, ensure_ascii=False)
