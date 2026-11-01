from datetime import datetime, timedelta, timezone
import pytest
from src.core.android_agent.automation_engine import AutomationEngine, classify_download, health_summary

def test_download_classification():
    assert classify_download("movie.MP4") == "videos"
    assert classify_download("scan.pdf") == "documents"
    assert classify_download("x.bin") == "other"

def test_health_report():
    report=health_summary({"battery_percent":10,"storage_free_bytes":5,"storage_total_bytes":100})
    assert report["status"]=="warning" and set(report["warnings"])=={"LOW_BATTERY","LOW_STORAGE"}
    assert health_summary({})["status"]=="unknown"

def test_scheduler_allowlist_history_and_audit():
    engine=AutomationEngine(); calls=[]
    engine.register_handler("daily_report",lambda p:calls.append(p) or {"report":"ok"})
    task=engine.schedule("Daily health","daily_report",interval_seconds=86400,start_at=datetime.now(timezone.utc)-timedelta(seconds=1))
    result=engine.run_due()
    assert result[0]["status"]=="succeeded" and calls==[{}]
    assert engine.history()[0]["automation_id"]==task and engine.audit_events()

def test_reject_unknown_handler_and_short_interval():
    engine=AutomationEngine()
    with pytest.raises(ValueError,match="HANDLER_NOT_ALLOWLISTED"): engine.schedule("bad","shell",interval_seconds=3600)
    engine.register_handler("safe",lambda _: {})
    with pytest.raises(ValueError,match="INTERVAL_TOO_SHORT"): engine.schedule("bad","safe",interval_seconds=1)

def test_failure_pauses_after_retry_limit_and_redacts_error():
    engine=AutomationEngine(max_attempts=1)
    engine.register_handler("flaky",lambda _: (_ for _ in ()).throw(RuntimeError("secret details")))
    task=engine.schedule("retry","flaky",interval_seconds=3600,start_at=datetime.now(timezone.utc)-timedelta(seconds=1))
    result=engine.run_due()
    assert result[0]["status"]=="failed" and result[0]["retry_scheduled"] is False
    with engine._connect() as db: assert db.execute("SELECT enabled FROM automations WHERE id=?",(task,)).fetchone()[0]==0
    assert "secret details" not in str(engine.audit_events())

def test_undo_requires_registered_inverse():
    engine=AutomationEngine(); restored=[]
    engine.register_handler("safe_change",lambda _:{"undo_payload":{"token":"abc"}},undo_handler=lambda data:restored.append(data))
    engine.schedule("reversible","safe_change",interval_seconds=3600,start_at=datetime.now(timezone.utc)-timedelta(seconds=1))
    run=engine.run_due()[0]
    assert engine.undo(run["run_id"])["status"]=="undone" and restored==[{"token":"abc"}]
    assert engine.undo(run["run_id"])["reason"]=="ALREADY_UNDONE"
