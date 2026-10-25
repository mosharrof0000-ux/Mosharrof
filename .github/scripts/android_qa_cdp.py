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
        self.ws = websocket.create_connection(ws_url, timeout=15)
        self.next_id = 0
        self.retry_events = retry_events if retry_events is not None else []

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


def inspect_answer_visibility(cdp: PageCDP) -> dict:
    """Bring the newest assistant message into the actual scroll viewport and measure it."""
    result = cdp.evaluate("""(() => {
      const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
      const last = nodes[nodes.length - 1];
      const body = last && last.querySelector('.rich-content');
      if (!last || !body || !body.innerText.trim()) return {visible:false, text:'', rect:null};

      // The app scrolls inside its message pane, not necessarily the document.
      // Scroll every overflow container from the answer outward, then align the
      // message itself. Measuring only .rich-content can report a zero-width
      // rect when its children provide the rendered layout.
      let parent = last.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const style = getComputedStyle(parent);
        const canScroll = /(auto|scroll|overlay)/.test(style.overflowY) &&
          parent.scrollHeight > parent.clientHeight;
        if (canScroll) parent.scrollTop = parent.scrollHeight;
        parent = parent.parentElement;
      }
      last.scrollIntoView({block:'end', inline:'nearest', behavior:'instant'});
      const r = last.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      const x = b.width > 0 ? b : r;
      const visible = x.width > 0 && x.height > 0 &&
        x.bottom > 0 && x.top < window.innerHeight &&
        x.right > 0 && x.left < window.innerWidth;
      return {visible, text:body.innerText.trim(),
        rect:{top:x.top,bottom:x.bottom,left:x.left,right:x.right,width:x.width,height:x.height},
        messageRect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height},
        viewport:{width:window.innerWidth,height:window.innerHeight}};
    })()""", retry_safe=True)
    return result if isinstance(result, dict) else {"visible": False, "text": "", "rect": None}
