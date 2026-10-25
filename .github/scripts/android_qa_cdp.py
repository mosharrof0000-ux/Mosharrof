"""Bounded page-target CDP client for Android WebView smoke tests."""
from __future__ import annotations

import base64
import json
import re
import time
from pathlib import Path

import websocket

class PageCDP:
    """Minimal page-target CDP client with bounded retries for idempotent commands."""

    def __init__(self, ws_url: str, retry_events: list[dict] | None = None):
        self.next_id = 0
        self.retry_events = retry_events if retry_events is not None else []
        self.ws = None
        for attempt in range(3):
            try:
                self.ws = websocket.create_connection(ws_url, timeout=15)
                break
            except (websocket.WebSocketTimeoutException, OSError) as exc:
                if attempt >= 2:
                    raise
                self.retry_events.append({
                    "method": "websocket_connect",
                    "attempt": attempt + 1,
                    "reason": type(exc).__name__,
                })
                time.sleep(0.5 * (attempt + 1))
        if self.ws is None:
            raise TimeoutError("Could not connect to Android WebView CDP endpoint after 3 attempts")

    def command(self, method: str, params: dict | None = None, timeout: float = 15, retries: int = 0) -> dict:
        for attempt in range(retries + 1):
            self.next_id += 1
            command_id = self.next_id
            self.ws.settimeout(timeout)
            self.ws.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
            deadline = time.monotonic() + timeout
            try:
                while time.monotonic() < deadline:
                    message = json.loads(self.ws.recv())
                    if message.get("id") != command_id:
                        continue
                    if "error" in message:
                        raise RuntimeError(f"CDP {method} failed: {message['error']}")
                    return message.get("result", {})
            except websocket.WebSocketTimeoutException:
                if attempt >= retries:
                    raise
                self.retry_events.append({
                    "method": method, "attempt": attempt + 1, "reason": "response_timeout"
                })
                time.sleep(0.25)
        raise TimeoutError(f"Timed out waiting for CDP command {method}")

    def evaluate(self, expression: str, timeout: float = 15, retry_safe: bool = False):
        result = self.command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            timeout=timeout,
            retries=2 if retry_safe else 0,
        )
        if "exceptionDetails" in result:
            raise RuntimeError(f"Page JavaScript exception: {result['exceptionDetails']}")
        return result.get("result", {}).get("value")

    def screenshot(self, path: Path) -> None:
        result = self.command(
            "Page.captureScreenshot",
            {"format": "png", "captureBeyondViewport": True},
            retries=2,
        )
        path.write_bytes(base64.b64decode(result["data"]))

    def close(self) -> None:
        self.ws.close()


def resolve_provider(provider: str | None, route: str) -> str | None:
    """Use explicit provider metadata first; infer only from the visible route label."""
    if provider:
        return provider
    match = re.search(r"উত্তর:\s*(Gemini|Workers AI|Groq|OpenRouter)\b", route or "", re.IGNORECASE)
    return match.group(1) if match else None


def answer_is_visibly_rendered(result: dict | None) -> bool:
    """Reject text that exists in the DOM but is collapsed to an unreadable sliver."""
    if not isinstance(result, dict) or result.get("visible") is not True:
        return False
    if not str(result.get("text") or "").strip():
        return False
    rect = result.get("rect") or {}
    viewport = result.get("viewport") or {}
    try:
        left, right = float(rect["left"]), float(rect["right"])
        top, bottom = float(rect["top"]), float(rect["bottom"])
        width, height = float(rect["width"]), float(rect["height"])
        viewport_width, viewport_height = float(viewport["width"]), float(viewport["height"])
    except (KeyError, TypeError, ValueError):
        return False
    min_readable_width = min(120.0, max(48.0, viewport_width * 0.4))
    visible_width = max(0.0, min(right, viewport_width) - max(left, 0.0))
    visible_height = max(0.0, min(bottom, viewport_height) - max(top, 0.0))
    return (
        width >= min_readable_width
        and visible_width >= min_readable_width
        and height >= 12.0
        and visible_height >= 12.0
    )

def inspect_answer_visibility(cdp: PageCDP) -> dict:
    """Capture answer visibility plus the sizing chain when an Android WebView collapses layout."""
    result = cdp.evaluate("""(() => {
      const measure = (el) => {
        if (!el) return null;
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return {rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height},
          display:s.display,width:s.width,maxWidth:s.maxWidth,minWidth:s.minWidth,
          alignSelf:s.alignSelf,flex:s.flex,boxSizing:s.boxSizing,overflowX:s.overflowX,overflowY:s.overflowY};
      };
      const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
      const last = nodes[nodes.length - 1];
      const body = last && last.querySelector('.rich-content');
      const scroll = document.querySelector('#chatScroll');
      if (!last || !body || !body.innerText.trim())
        return {visible:false,text:'',rect:null,layout:{messages:measure(document.querySelector('#messages')),scroll:measure(scroll)}};
      let parent = last.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const s = getComputedStyle(parent);
        if (/(auto|scroll|overlay)/.test(s.overflowY) && parent.scrollHeight > parent.clientHeight)
          parent.scrollTop = parent.scrollHeight;
        parent = parent.parentElement;
      }
      last.scrollIntoView({block:'end',inline:'nearest',behavior:'instant'});
      const r = last.getBoundingClientRect(), b = body.getBoundingClientRect(), x = b.width > 0 ? b : r;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const minReadableWidth = Math.min(120, Math.max(48, viewportWidth * 0.4));
      const visibleWidth = Math.max(0, Math.min(x.right, viewportWidth) - Math.max(x.left, 0));
      const visibleHeight = Math.max(0, Math.min(x.bottom, viewportHeight) - Math.max(x.top, 0));
      const visible = x.width >= minReadableWidth && visibleWidth >= minReadableWidth &&
        x.height >= 12 && visibleHeight >= 12;
      return {visible,minReadableWidth,visibleWidth,visibleHeight,text:body.innerText.trim(),
        rect:{top:x.top,bottom:x.bottom,left:x.left,right:x.right,width:x.width,height:x.height},
        messageRect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height},
        viewport:{width:viewportWidth,height:viewportHeight},
        layout:{messages:measure(document.querySelector('#messages')),message:measure(last),body:measure(body),scroll:measure(scroll)}};
    })()""", retry_safe=True)
    return result if isinstance(result, dict) else {"visible": False, "text": "", "rect": None}
