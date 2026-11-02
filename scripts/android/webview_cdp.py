"""Bounded retries for transient Android WebView CDP initialization timeouts."""
from __future__ import annotations

import time


def connect_page_cdp(ws_url: str, client_type, attempts: int = 3):
    """Reconnect between bounded attempts; preserve the smoke test assertions."""
    failures: list[str] = []
    for attempt in range(1, attempts + 1):
        client = None
        try:
            client = client_type(ws_url)
            client.command("Page.enable", timeout=25)
            client.command("Runtime.enable", timeout=25)
            return client
        except Exception as exc:
            failures.append(f"attempt {attempt}/{attempts}: {type(exc).__name__}: {str(exc)[:240]}")
            if client is not None:
                try:
                    client.close()
                except Exception:
                    pass
            if attempt < attempts:
                time.sleep(2 * attempt)
    raise TimeoutError("WebView CDP initialization failed after retries: " + " | ".join(failures))
