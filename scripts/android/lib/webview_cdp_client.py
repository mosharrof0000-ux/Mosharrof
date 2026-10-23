#!/usr/bin/env python3
"""Isolated WebView CDP transport with bounded reconnect diagnostics."""
from __future__ import annotations

import base64
import json
import time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import websocket


class PageCDP:
    """Minimal page-target CDP client for Android WebView."""

    def __init__(self, ws_url: str, endpoint_url: str):
        advertised = urlsplit(ws_url)
        endpoint = urlsplit(endpoint_url)
        if advertised.scheme not in ("ws", "wss") or not advertised.path:
            raise ValueError(f"Invalid WebView CDP WebSocket URL: {ws_url!r}")
        host = endpoint.hostname or "127.0.0.1"
        port = endpoint.port or (443 if advertised.scheme == "wss" else 80)
        self.normalized_url = urlunsplit((
            advertised.scheme, f"{host}:{port}", advertised.path,
            advertised.query, ""
        ))
        self.next_id = 0
        self.ws = self._connect_with_retry()

    def _connect_with_retry(self):
        last_error = None
        for attempt in range(1, 4):
            try:
                return websocket.create_connection(
                    self.normalized_url, timeout=20, suppress_origin=True
                )
            except Exception as exc:
                last_error = exc
                if attempt == 3:
                    raise TimeoutError(
                        f"Unable to connect to WebView CDP after {attempt} attempts "
                        f"at {self.normalized_url}: {type(exc).__name__}: {exc}"
                    ) from exc
                time.sleep(attempt * 2)
        raise TimeoutError(f"Unable to connect to WebView CDP: {last_error}")

    def command(self, method: str, params: dict | None = None, timeout: float = 15) -> dict:
        last_error = None
        for attempt in range(2):
            self.next_id += 1
            command_id = self.next_id
            try:
                self.ws.settimeout(timeout)
                self.ws.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
                deadline = time.monotonic() + timeout
                while time.monotonic() < deadline:
                    message = json.loads(self.ws.recv())
                    if message.get("id") != command_id:
                        continue
                    if "error" in message:
                        raise RuntimeError(f"CDP {method} failed: {message['error']}")
                    return message.get("result", {})
                raise TimeoutError(f"Timed out waiting for CDP command {method}")
            except (websocket.WebSocketConnectionClosedException, OSError, TimeoutError) as exc:
                last_error = exc
                if attempt == 0:
                    try:
                        self.ws.close()
                    except Exception:
                        pass
                    self.ws = self._connect_with_retry()
                    continue
                raise RuntimeError(
                    f"CDP command {method} failed after reconnect: "
                    f"{type(exc).__name__}: {exc}"
                ) from exc
        raise RuntimeError(f"CDP command {method} failed: {last_error}")

    def evaluate(self, expression: str, timeout: float = 15):
        result = self.command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            timeout=timeout,
        )
        if "exceptionDetails" in result:
            raise RuntimeError(f"Page JavaScript exception: {result['exceptionDetails']}")
        return result.get("result", {}).get("value")

    def screenshot(self, path: Path) -> None:
        result = self.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
        path.write_bytes(base64.b64decode(result["data"]))

    def close(self) -> None:
        self.ws.close()
