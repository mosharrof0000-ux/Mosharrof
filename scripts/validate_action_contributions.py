#!/usr/bin/env python3
"""Static contract checks for Mosharrof's menu/action-bar contribution registry."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "web/modules/action-contributions/manifest.json"
RUNTIME = ROOT / "web/modules/action-contributions/index.js"
ENTRYPOINT = ROOT / "web/index.html"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def validate():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    runtime = RUNTIME.read_text(encoding="utf-8")
    html = ENTRYPOINT.read_text(encoding="utf-8")

    require(manifest.get("registry_id") == "mosharrof.ui.action_contributions",
            "unexpected registry id")
    groups = manifest.get("groups", [])
    group_ids = [group.get("id") for group in groups]
    require(len(group_ids) == len(set(group_ids)), "duplicate group id")
    require("message-actions" in group_ids, "existing message action group not registered")

    contributions = manifest.get("contributions", [])
    ids = [item.get("id") for item in contributions]
    require(ids and len(ids) == len(set(ids)), "missing or duplicate contribution id")
    for item in contributions:
        require(item.get("group_id") in group_ids, f"unknown group for {item.get('id')}")
        require(item.get("placement") == "message_action_bar",
                f"unsupported placement for {item.get('id')}")
        require(set(item.get("operation_modes", [])) == {"manual", "automatic"},
                f"both operation modes must be declared for {item.get('id')}")
        if item.get("automatic_ready"):
            require(bool(item.get("automatic_policy_id")),
                    f"automatic action lacks policy id: {item.get('id')}")
        else:
            require(bool(item.get("automatic_block_reason")),
                    f"blocked automatic action needs a reason: {item.get('id')}")

    require('./modules/action-contributions/index.js' in html,
            "web/index.html does not load the action contribution runtime")
    require("message-actions" in html and "function addMessageToolbar" in html,
            "existing message toolbar hook not found in entrypoint")
    require("MOSHARROF_ACTION_CONTRIBUTIONS" in runtime,
            "runtime API not exposed")
    require("MutationObserver" in runtime,
            "runtime does not observe newly rendered message actions")
    require("data-automatic-ready" in runtime,
            "runtime does not publish automatic readiness")
    require("existing controls and handlers remain untouched" in runtime,
            "fail-closed compatibility note missing")

    # Every mapped Bengali label must still be represented by the existing UI source.
    for item in contributions:
        value = item.get("match", {}).get("value")
        if item.get("match", {}).get("attribute") == "text":
            require(value in html, f"existing action label missing from HTML: {value}")
    return len(groups), len(contributions)


if __name__ == "__main__":
    try:
        groups, contributions = validate()
        print(f"Action contribution contract OK: {groups} group(s), {contributions} contribution(s)")
    except Exception as exc:
        print(f"Action contribution contract FAILED: {exc}", file=sys.stderr)
        sys.exit(1)