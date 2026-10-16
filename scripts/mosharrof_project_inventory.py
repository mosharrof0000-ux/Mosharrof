#!/usr/bin/env python3
"""Read-only, evidence-backed inventory of a public GitHub project.

This tool never writes to GitHub, edits files, opens PRs, or deploys code.
It emits a JSON snapshot and clearly marks data sources that could not be read.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

DEFAULT_REPOSITORY = "mosharrof0000-ux/Mosharrof"
API_ROOT = "https://api.github.com"
USER_AGENT = "MOSHARROF-Project-Inventory/1.0"


class InventoryError(RuntimeError):
    """Raised when the core repository state cannot be verified."""


def _request_json(url: str, timeout: int = 12) -> Any:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    # A token may improve rate limits; never print or include it in the report.
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _safe_get(url: str) -> tuple[Any | None, str | None]:
    try:
        return _request_json(url), None
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError, ValueError) as exc:
        # Error text can include URLs or response details; report only the class.
        return None, type(exc).__name__


def _api(repo: str, suffix: str) -> str:
    owner, name = repo.split("/", 1)
    return f"{API_ROOT}/repos/{quote(owner, safe='')}/{quote(name, safe='')}/{suffix.lstrip('/')}"


def build_inventory(repo: str = DEFAULT_REPOSITORY, health_url: str | None = None) -> dict[str, Any]:
    if repo.count("/") != 1 or any(not part.strip() for part in repo.split("/")):
        raise ValueError("Repository must be in owner/name format.")

    generated_at = datetime.now(timezone.utc).isoformat()
    metadata, metadata_error = _safe_get(_api(repo, ""))
    if not isinstance(metadata, dict) or metadata_error:
        raise InventoryError(f"Could not verify repository metadata ({metadata_error or 'invalid_response'}).")

    default_branch = metadata.get("default_branch")
    if not isinstance(default_branch, str) or not default_branch:
        raise InventoryError("Repository metadata did not include a valid default branch.")

    commit_data, commit_error = _safe_get(_api(repo, f"commits/{quote(default_branch, safe='')}"))
    pulls, pulls_error = _safe_get(_api(repo, "pulls?state=open&per_page=100"))
    workflows, workflows_error = _safe_get(_api(repo, "actions/runs?per_page=10"))

    commit = {}
    if isinstance(commit_data, dict):
        commit = {
            "sha": commit_data.get("sha"),
            "url": commit_data.get("html_url"),
            "message": ((commit_data.get("commit") or {}).get("message") or "").splitlines()[0][:180],
            "committed_at": ((commit_data.get("commit") or {}).get("committer") or {}).get("date"),
        }

    open_prs = []
    if isinstance(pulls, list):
        for item in pulls:
            if not isinstance(item, dict):
                continue
            open_prs.append({
                "number": item.get("number"),
                "title": item.get("title"),
                "url": item.get("html_url"),
                "draft": bool(item.get("draft", False)),
                "base_branch": (item.get("base") or {}).get("ref"),
                "head_branch": (item.get("head") or {}).get("ref"),
                "head_sha": (item.get("head") or {}).get("sha"),
                "updated_at": item.get("updated_at"),
            })

    workflow_runs = []
    if isinstance(workflows, dict) and isinstance(workflows.get("workflow_runs"), list):
        for item in workflows["workflow_runs"]:
            if not isinstance(item, dict):
                continue
            workflow_runs.append({
                "id": item.get("id"),
                "name": item.get("name"),
                "event": item.get("event"),
                "branch": item.get("head_branch"),
                "head_sha": item.get("head_sha"),
                "status": item.get("status"),
                "conclusion": item.get("conclusion"),
                "url": item.get("html_url"),
                "created_at": item.get("created_at"),
                "updated_at": item.get("updated_at"),
            })

    health = {"checked": False, "url": health_url, "status": "not_requested"}
    if health_url:
        # Only GET a user-specified HTTPS URL. Never follow arbitrary URLs from API data.
        from urllib.parse import urlparse
        parsed = urlparse(health_url)
        if parsed.scheme != "https" or not parsed.netloc:
            health = {"checked": False, "url": health_url, "status": "rejected_non_https_url"}
        else:
            request = urllib.request.Request(
                health_url, headers={"User-Agent": USER_AGENT}, method="GET"
            )
            try:
                with urllib.request.urlopen(request, timeout=10) as response:
                    health = {
                        "checked": True,
                        "url": health_url,
                        "status": "healthy" if 200 <= response.status < 400 else "unhealthy",
                        "http_status": response.status,
                    }
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
                status_code = getattr(exc, "code", None)
                health = {
                    "checked": True,
                    "url": health_url,
                    "status": "unhealthy",
                    "http_status": status_code,
                    "error_type": type(exc).__name__,
                }

    warnings = []
    if commit_error or not commit:
        warnings.append("default_branch_commit_unavailable")
    if pulls_error or not isinstance(pulls, list):
        warnings.append("open_pull_requests_unavailable")
    if workflows_error or not isinstance(workflows, dict):
        warnings.append("workflow_runs_unavailable")
    if health.get("status") == "unhealthy":
        warnings.append("health_check_failed")
    if health.get("status") == "rejected_non_https_url":
        warnings.append("health_check_url_rejected")

    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "mode": "read_only",
        "repository": {
            "full_name": metadata.get("full_name", repo),
            "url": metadata.get("html_url"),
            "private": bool(metadata.get("private", False)),
            "default_branch": default_branch,
            "default_branch_url": f"https://github.com/{repo}/tree/{quote(default_branch, safe='')}",
            "last_pushed_at": metadata.get("pushed_at"),
        },
        "default_branch_commit": commit or None,
        "open_pull_requests": open_prs if isinstance(pulls, list) else None,
        "recent_workflow_runs": workflow_runs if isinstance(workflows, dict) else None,
        "health_check": health,
        "source_status": {
            "repository_metadata": "verified",
            "default_branch_commit": "verified" if commit else f"unavailable:{commit_error or 'invalid_response'}",
            "open_pull_requests": "verified" if isinstance(pulls, list) else f"unavailable:{pulls_error or 'invalid_response'}",
            "workflow_runs": "verified" if isinstance(workflows, dict) else f"unavailable:{workflows_error or 'invalid_response'}",
        },
        "warnings": warnings,
        "safety": {
            "writes_performed": False,
            "deployment_performed": False,
            "secrets_included": False,
            "promotion_allowed": False,
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=os.environ.get("GH_REPO", DEFAULT_REPOSITORY),
                        help="GitHub repository in owner/name format")
    parser.add_argument("--health-url", default=None,
                        help="Optional HTTPS URL to check (GET only)")
    parser.add_argument("--output", default="-", help="JSON output path, or - for stdout")
    args = parser.parse_args(argv)
    try:
        report = build_inventory(args.repo, args.health_url)
    except (InventoryError, ValueError) as exc:
        print(f"INVENTORY_FAILED: {exc}", file=sys.stderr)
        return 2
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output == "-":
        sys.stdout.write(rendered)
    else:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write(rendered)
    return 1 if report["warnings"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
