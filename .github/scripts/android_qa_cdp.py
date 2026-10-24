"""Bounded page-target CDP client for Android WebView smoke tests."""
from __future__ import annotations

import base64
import json
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
