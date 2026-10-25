from __future__ import annotations

import importlib.util
import io
import json
import sys
import types
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / ".github" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import android_qa_targets


def test_target_discovery_refreshes_snapshot_and_preserves_initial_evidence(tmp_path, monkeypatch):
    snapshot = tmp_path / "webview-targets.json"
    stale = [{"id": "stale-target", "url": "https://localhost/"}]
    fresh = [{"id": "fresh-target", "url": "https://localhost/", "type": "page"}]
    snapshot.write_text(json.dumps(stale), encoding="utf-8")

    def fake_urlopen(url, timeout):
        assert url == "http://127.0.0.1:9222/json/list"
        assert timeout == 10
        return io.BytesIO(json.dumps(fresh).encode("utf-8"))

    monkeypatch.setattr(android_qa_targets, "urlopen", fake_urlopen)
    result = android_qa_targets.fetch_webview_targets("http://127.0.0.1:9222/", snapshot)

    assert result == fresh
    assert json.loads(snapshot.read_text(encoding="utf-8")) == fresh
    assert json.loads((tmp_path / "webview-targets-initial.json").read_text(encoding="utf-8")) == stale


def test_target_discovery_does_not_silently_use_stale_snapshot(tmp_path, monkeypatch):
    snapshot = tmp_path / "webview-targets.json"
    stale = [{"id": "stale-target"}]
    snapshot.write_text(json.dumps(stale), encoding="utf-8")

    def fail_urlopen(url, timeout):
        raise TimeoutError("CDP endpoint unavailable")

    monkeypatch.setattr(android_qa_targets, "urlopen", fail_urlopen)
    with pytest.raises(TimeoutError, match="CDP endpoint unavailable"):
        android_qa_targets.fetch_webview_targets("http://127.0.0.1:9222", snapshot)

    assert json.loads(snapshot.read_text(encoding="utf-8")) == stale
    assert json.loads((tmp_path / "webview-targets-initial.json").read_text(encoding="utf-8")) == stale


def _load_cdp_with_fake_websocket(monkeypatch, create_connection):
    fake_websocket = types.ModuleType("websocket")

    class WebSocketTimeoutException(Exception):
        pass

    fake_websocket.WebSocketTimeoutException = WebSocketTimeoutException
    fake_websocket.create_connection = create_connection
    monkeypatch.setitem(sys.modules, "websocket", fake_websocket)
    spec = importlib.util.spec_from_file_location(
        "android_qa_cdp_test_module", SCRIPTS / "android_qa_cdp.py"
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module, WebSocketTimeoutException


def test_cdp_connect_retries_two_transient_timeouts_then_succeeds(monkeypatch):
    attempts = []
    socket = types.SimpleNamespace(close=lambda: None)

    def fake_create_connection(url, timeout):
        attempts.append((url, timeout))
        if len(attempts) < 3:
            raise TimeoutError("Connection timed out")
        return socket

    module, timeout_error = _load_cdp_with_fake_websocket(monkeypatch, fake_create_connection)
    monkeypatch.setattr(module.time, "sleep", lambda _delay: None)
    events = []
    client = module.PageCDP("ws://127.0.0.1:9222/devtools/page/test", events)

    assert len(attempts) == 3
    assert client.ws is socket
    assert [event["attempt"] for event in events] == [1, 2]
    assert all(event["method"] == "websocket_connect" for event in events)
    client.close()


def test_cdp_connect_stops_after_three_total_attempts(monkeypatch):
    attempts = []

    def fake_create_connection(url, timeout):
        attempts.append(url)
        raise TimeoutError("Connection timed out")

    module, timeout_error = _load_cdp_with_fake_websocket(monkeypatch, fake_create_connection)
    monkeypatch.setattr(module.time, "sleep", lambda _delay: None)
    events = []
    with pytest.raises(TimeoutError, match="Connection timed out"):
        module.PageCDP("ws://127.0.0.1:9222/devtools/page/test", events)

    assert len(attempts) == 3
    assert len(events) == 2
