"""Small page-target Chrome DevTools Protocol client for Android WebView QA."""
from __future__ import annotations

import base64
import json
import time
from pathlib import Path

import websocket


class PageCDP:
    """Minimal page-target CDP client, avoiding unsupported Browser-domain methods."""

    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=15)
        self.next_id = 0

    def command(self, method: str, params: dict | None = None, timeout: float = 30) -> dict:
        self.next_id += 1
        command_id = self.next_id
        self.ws.settimeout(timeout)
        self.ws.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                message = json.loads(self.ws.recv())
            except websocket.WebSocketTimeoutException:
                # WebView emits asynchronous CDP events. A quiet interval is not
                # a failed command; keep waiting until this command's deadline.
                continue
            if message.get("id") != command_id:
                continue
            if "error" in message:
                raise RuntimeError(f"CDP {method} failed: {message['error']}")
            return message.get("result", {})
        raise TimeoutError(f"Timed out waiting for CDP command {method} after {timeout}s")

    def evaluate(self, expression: str, timeout: float = 30):
        result = self.command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            timeout=timeout,
        )
        if "exceptionDetails" in result:
            raise RuntimeError(f"Page JavaScript exception: {result['exceptionDetails']}")
        return result.get("result", {}).get("value")

    def screenshot(self, path: Path) -> None:
        # A freshly started Android WebView can time out on its first capture while
        # the renderer is still settling. Capture only the viewport and retry once.
        last_error = None
        for attempt in range(2):
            try:
                result = self.command("Page.captureScreenshot", {"format": "png"}, timeout=45)
                path.write_bytes(base64.b64decode(result["data"]))
                return
            except Exception as exc:
                last_error = exc
                if attempt == 0:
                    time.sleep(1)
        raise RuntimeError(
            f"CDP screenshot failed after 2 attempts: {type(last_error).__name__}: {last_error}"
        ) from last_error

    def close(self) -> None:
        self.ws.close()
