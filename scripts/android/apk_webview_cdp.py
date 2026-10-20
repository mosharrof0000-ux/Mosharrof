#!/usr/bin/env python3
"""Page-level Chrome DevTools Protocol helper for Android WebView chat QA."""
from __future__ import annotations

import base64
import json
import subprocess
import time

import websocket


class PageCDP:
    """Minimal page-target CDP client, avoiding unsupported Browser-domain methods."""

    def __init__(self, ws_url: str):
        # Android WebView CDP can publish its target before the page socket is
        # ready. Retry the page target and avoid an Origin header, which some
        # embedded WebView builds reject or leave hanging.
        self.ws = None
        errors = []
        candidates = [ws_url]
        if "127.0.0.1" in ws_url:
            candidates.append(ws_url.replace("127.0.0.1", "localhost", 1))
        for attempt in range(1, 7):
            for candidate in candidates:
                try:
                    self.ws = websocket.create_connection(
                        candidate,
                        timeout=6,
                        suppress_origin=True,
                        http_proxy_host=None,
                        http_proxy_port=None,
                        http_no_proxy=["127.0.0.1", "localhost"],
                    )
                    break
                except Exception as exc:
                    errors.append(f"attempt={attempt} url={candidate}: {type(exc).__name__}: {str(exc)[:160]}")
            if self.ws is not None:
                break
            time.sleep(min(attempt * 2, 8))
        if self.ws is None:
            raise RuntimeError(
                "Could not open Android WebView CDP page socket after retries. "
                "Check adb forward target, WebView DevTools socket, and local proxy bypass. "
                + " | ".join(errors[-8:])
            )
        self.next_id = 0

    def command(self, method: str, params: dict | None = None, timeout: float = 15) -> dict:
        self.next_id += 1
        command_id = self.next_id
        self.ws.send(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        deadline = time.monotonic() + timeout
        # WebView sends asynchronous events on the same socket. A receive timeout
        # is only a polling interval; keep waiting for this command's reply until
        # its overall deadline, rather than failing on the first quiet second.
        self.ws.settimeout(min(1.0, timeout))
        while time.monotonic() < deadline:
            try:
                message = json.loads(self.ws.recv())
            except websocket.WebSocketTimeoutException:
                continue
            if message.get("id") != command_id:
                continue
            if "error" in message:
                raise RuntimeError(f"CDP {method} failed: {message['error']}")
            return message.get("result", {})
        raise TimeoutError(f"Timed out waiting for CDP command {method} after {timeout}s")

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
        # Native Android screencap is more reliable than Page.captureScreenshot
        # on some System WebView versions and preserves useful failure evidence.
        try:
            shot = subprocess.run(
                ["adb", "exec-out", "screencap", "-p"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=20,
                check=True,
            )
            if shot.stdout.startswith(b"\x89PNG\r\n\x1a\n"):
                path.write_bytes(shot.stdout)
                print(f"[android-qa] screenshot captured via adb: {path}", flush=True)
                return
            raise RuntimeError("adb screencap returned non-PNG output")
        except Exception as exc:
            print(f"[android-qa] adb screenshot unavailable: {type(exc).__name__}: {str(exc)[:160]}; trying CDP", flush=True)
        result = self.command(
            "Page.captureScreenshot",
            {"format": "png", "captureBeyondViewport": False},
            timeout=10,
        )
        path.write_bytes(base64.b64decode(result["data"]))

    def close(self) -> None:
        self.ws.close()
