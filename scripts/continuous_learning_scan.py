#!/usr/bin/env python3
"""Read-only, bounded RSS/Atom scanner for continuous-learning reports."""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "organs" / "continuous-learning-orchestrator" / "sources.json"
OUT = Path(os.environ.get("MOSHARROF_LEARNING_REPORT", ROOT / "learning-report.json"))
MAX_BYTES = 1_048_576
MAX_ITEMS = 10
TIMEOUT = 12
ALLOWED_HOSTS = {
    "openai.com",
    "blog.research.google",
    "github.blog",
    "export.arxiv.org",
}


def validate_feed(feed: dict) -> str:
    url = feed.get("url")
    if not isinstance(url, str):
        raise ValueError("feed URL must be a string")
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("only HTTPS URLs without embedded credentials are allowed")
    if parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError("feed host is not on the exact host allowlist")
    if not feed.get("id") or not feed.get("domain") or not feed.get("provider"):
        raise ValueError("feed id, domain, and provider are required")
    return url


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def text_of(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return " ".join("".join(node.itertext()).split())[:1200]


def parse_feed(payload: bytes, feed: dict, now: str) -> dict:
    if len(payload) > MAX_BYTES:
        raise ValueError("feed exceeds maximum permitted size")
    root = ET.fromstring(payload)
    entries = [node for node in root.iter() if local_name(node.tag) in {"item", "entry"}]
    items = []
    for entry in entries[:MAX_ITEMS]:
        fields = {}
        for child in list(entry):
            name = local_name(child.tag)
            if name in {"title", "summary", "description", "published", "updated", "pubdate", "date", "link"}:
                if name == "link":
                    href = child.attrib.get("href")
                    value = href or text_of(child)
                else:
                    value = text_of(child)
                fields.setdefault(name, value)
        link = fields.get("link", "")
        if link:
            parsed_link = urlparse(link)
            if parsed_link.scheme != "https" or not parsed_link.hostname or parsed_link.username or parsed_link.password:
                link = ""
        title = fields.get("title", "")
        if not title:
            continue
        items.append({
            "title": title[:300],
            "url": link,
            "summary": (fields.get("summary") or fields.get("description") or "")[:1200],
            "published_at": fields.get("published") or fields.get("updated") or fields.get("pubdate") or fields.get("date") or None,
            "domain": feed["domain"],
            "provider": feed["provider"],
            "retrieved_at": now,
            "reliability": "source-origin-only-not-independently-verified",
        })
    return {"feed_id": feed["id"], "provider": feed["provider"], "status": "ok", "items": items}


def fetch_feed(feed: dict, now: str) -> dict:
    url = validate_feed(feed)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MOSHARROF-AI-LearningMonitor/1.0 (read-only; bounded research)",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            payload = response.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise ValueError("feed exceeds maximum permitted size")
        if content_type and not any(token in content_type for token in ("xml", "rss", "atom", "text/plain", "octet-stream")):
            raise ValueError("unexpected response content type")
        return parse_feed(payload, feed, now)
    except (urllib.error.URLError, TimeoutError, OSError, ET.ParseError, ValueError) as exc:
        return {"feed_id": feed.get("id", "unknown"), "provider": feed.get("provider", "unknown"), "status": "unavailable-or-invalid", "items": [], "error": str(exc)[:400]}


def build_report(config: dict, now: str | None = None) -> dict:
    now = now or datetime.now(timezone.utc).isoformat()
    feeds = config.get("feeds", [])
    if not isinstance(feeds, list) or len(feeds) > 20:
        raise ValueError("feed list must be an array with at most 20 entries")
    results = [fetch_feed(feed, now) for feed in feeds]
    total = sum(len(result["items"]) for result in results)
    return {
        "schema_version": 1,
        "generated_at": now,
        "mode": "read-only-report",
        "live_mutation": False,
        "secret_access": False,
        "external_provider_api_calls": False,
        "feeds_checked": len(results),
        "feeds_available": sum(result["status"] == "ok" for result in results),
        "items_found": total,
        "results": results,
        "coverage_gaps": config.get("coverage_gaps", []),
        "limitations": [
            "Feed presence does not prove that an item is true or important.",
            "Each item needs independent verification before becoming trusted knowledge.",
            "Gemini and Grok official update feeds remain explicitly unconfigured until verified.",
            "This report does not modify source code, open PRs, access secrets, or deploy changes."
        ],
    }


def main() -> int:
    try:
        config = json.loads(CONFIG.read_text(encoding="utf-8"))
        report = build_report(config)
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({k: report[k] for k in ("generated_at", "feeds_checked", "feeds_available", "items_found", "mode")}, ensure_ascii=False))
        return 0 if report["feeds_checked"] else 1
    except Exception as exc:
        print(f"continuous learning scan failed safely: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
