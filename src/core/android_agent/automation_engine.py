"""Fail-closed, auditable automation scheduler for Mosharrof Android Agent."""
from __future__ import annotations
import json, sqlite3, uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
Handler = Callable[[dict[str, Any]], dict[str, Any] | None]
def _now(): return datetime.now(timezone.utc)
def classify_download(name: str, mime_type: str = "") -> str:
    suffix, mime = Path(name or "").suffix.lower(), (mime_type or "").lower()
    if mime.startswith("image/") or suffix in {".jpg",".jpeg",".png",".gif",".webp",".heic",".svg"}: return "images"
    if mime.startswith("video/") or suffix in {".mp4",".mkv",".mov",".webm",".avi",".3gp"}: return "videos"
    if mime.startswith("audio/") or suffix in {".mp3",".m4a",".wav",".ogg",".flac",".aac"}: return "audio"
    if suffix in {".pdf",".doc",".docx",".txt",".rtf",".odt",".xls",".xlsx",".ppt",".pptx"}: return "documents"
    if suffix in {".zip",".7z",".rar",".tar",".gz"}: return "archives"
    return "other"
def health_summary(metrics: dict[str, Any]) -> dict[str, Any]:
    available = {k:v for k,v in metrics.items() if k in {"battery_percent","storage_free_bytes","storage_total_bytes","ram_available_bytes","ram_total_bytes"} and isinstance(v,(int,float)) and v >= 0}
    warnings=[]
    if available.get("battery_percent",100) <= 15: warnings.append("LOW_BATTERY")
    total, free = available.get("storage_total_bytes"), available.get("storage_free_bytes")
    if total and free is not None and free / total <= .10: warnings.append("LOW_STORAGE")
    return {"available":available,"warnings":warnings,"status":"warning" if warnings else ("ok" if available else "unknown")}
class AutomationEngine:
    """SQLite schedules, bounded retries, run history, audit and reversible actions."""
    def __init__(self, database=":memory:", *, max_attempts=3, retry_base_seconds=60):
        self.database=str(database); self.max_attempts=max(1,min(int(max_attempts),10)); self.retry_base_seconds=max(1,int(retry_base_seconds)); self.handlers={}; self.undo_handlers={}
        self._memory_connection = sqlite3.connect(":memory:") if self.database == ":memory:" else None
        if self._memory_connection is not None: self._memory_connection.row_factory = sqlite3.Row
        self._init_db()
    def _connect(self):
        if self._memory_connection is not None: return self._memory_connection
        db=sqlite3.connect(self.database); db.row_factory=sqlite3.Row; return db
    def _init_db(self):
        with self._connect() as db:
            db.executescript("""CREATE TABLE IF NOT EXISTS automations(id TEXT PRIMARY KEY,name TEXT NOT NULL,handler TEXT NOT NULL,interval_seconds INTEGER NOT NULL,payload TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,next_run TEXT NOT NULL,created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,automation_id TEXT NOT NULL,status TEXT NOT NULL,attempt INTEGER NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,result TEXT,error TEXT,undo_handler TEXT,undo_payload TEXT,undone_at TEXT);
            CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,event TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);""")
    def register_handler(self,name,handler,*,undo_handler=None):
        if not name or not name.replace("_","").isalnum(): raise ValueError("INVALID_HANDLER_NAME")
        self.handlers[name]=handler
        if undo_handler: self.undo_handlers[name]=undo_handler
    def _audit(self,db,event,details): db.execute("INSERT INTO audit(event,details,created_at) VALUES(?,?,?)",(event,json.dumps(details,ensure_ascii=False),_now().isoformat()))
    def schedule(self,name,handler,*,interval_seconds,payload=None,start_at=None):
        if handler not in self.handlers: raise ValueError("HANDLER_NOT_ALLOWLISTED")
        if interval_seconds < 60: raise ValueError("INTERVAL_TOO_SHORT")
        start=start_at or _now()
        if start.tzinfo is None: raise ValueError("START_TIME_MUST_BE_TIMEZONE_AWARE")
        task=str(uuid.uuid4())
        with self._connect() as db:
            db.execute("INSERT INTO automations VALUES(?,?,?,?,?,1,?,?)",(task,name,handler,int(interval_seconds),json.dumps(payload or {},ensure_ascii=False),start.astimezone(timezone.utc).isoformat(),_now().isoformat()))
            self._audit(db,"AUTOMATION_SCHEDULED",{"id":task,"handler":handler})
        return task
    def pause(self,task):
        with self._connect() as db:
            cur=db.execute("UPDATE automations SET enabled=0 WHERE id=?",(task,))
            if cur.rowcount: self._audit(db,"AUTOMATION_PAUSED",{"id":task})
            return cur.rowcount==1
    def resume(self,task):
        with self._connect() as db:
            cur=db.execute("UPDATE automations SET enabled=1,next_run=? WHERE id=?",(_now().isoformat(),task))
            if cur.rowcount: self._audit(db,"AUTOMATION_RESUMED",{"id":task})
            return cur.rowcount==1
    def run_due(self,*,now=None,limit=20):
        current=now or _now()
        if current.tzinfo is None: raise ValueError("NOW_MUST_BE_TIMEZONE_AWARE")
        if not 1<=limit<=100: raise ValueError("INVALID_BATCH_LIMIT")
        with self._connect() as db: rows=db.execute("SELECT * FROM automations WHERE enabled=1 AND next_run<=? ORDER BY next_run LIMIT ?",(current.astimezone(timezone.utc).isoformat(),limit)).fetchall()
        outcomes=[]
        for row in rows:
            run_id=str(uuid.uuid4()); started=_now().isoformat()
            with self._connect() as db:
                previous=db.execute("SELECT COUNT(*) n FROM runs WHERE automation_id=? AND status='failed' AND started_at>=?",(row["id"],(current-timedelta(days=1)).isoformat())).fetchone()["n"]
                attempt=min(int(previous)+1,self.max_attempts)
                db.execute("INSERT INTO runs(id,automation_id,status,attempt,started_at) VALUES(?,?,'running',?,?)",(run_id,row["id"],attempt,started))
            try:
                result=self.handlers[row["handler"]](json.loads(row["payload"])) or {}
                if not isinstance(result,dict): raise TypeError("HANDLER_RESULT_MUST_BE_OBJECT")
                undo_payload=result.get("undo_payload"); undo_handler=row["handler"] if undo_payload is not None and row["handler"] in self.undo_handlers else None; finished=_now()
                with self._connect() as db:
                    db.execute("UPDATE runs SET status='succeeded',finished_at=?,result=?,undo_handler=?,undo_payload=? WHERE id=?",(finished.isoformat(),json.dumps(result,ensure_ascii=False),undo_handler,json.dumps(undo_payload,ensure_ascii=False) if undo_handler else None,run_id))
                    db.execute("UPDATE automations SET next_run=? WHERE id=?",((finished+timedelta(seconds=row["interval_seconds"])).isoformat(),row["id"]))
                    self._audit(db,"AUTOMATION_SUCCEEDED",{"run_id":run_id,"automation_id":row["id"]})
                outcomes.append({"run_id":run_id,"status":"succeeded","result":result})
            except Exception as exc:
                finished=_now(); retry=attempt<self.max_attempts; delay=self.retry_base_seconds*(2**(attempt-1))
                with self._connect() as db:
                    db.execute("UPDATE runs SET status='failed',finished_at=?,error=? WHERE id=?",(finished.isoformat(),type(exc).__name__,run_id))
                    if retry: db.execute("UPDATE automations SET next_run=? WHERE id=?",((finished+timedelta(seconds=delay)).isoformat(),row["id"]))
                    else: db.execute("UPDATE automations SET enabled=0 WHERE id=?",(row["id"],))
                    self._audit(db,"AUTOMATION_FAILED",{"run_id":run_id,"retry_scheduled":retry,"error":type(exc).__name__})
                outcomes.append({"run_id":run_id,"status":"failed","retry_scheduled":retry,"error":type(exc).__name__})
        return outcomes
    def undo(self,run_id):
        with self._connect() as db: row=db.execute("SELECT * FROM runs WHERE id=?",(run_id,)).fetchone()
        if not row or row["status"]!="succeeded": return {"status":"denied","reason":"RUN_NOT_REVERSIBLE"}
        if row["undone_at"]: return {"status":"denied","reason":"ALREADY_UNDONE"}
        handler=row["undo_handler"]
        if not handler or handler not in self.undo_handlers: return {"status":"denied","reason":"NO_REGISTERED_UNDO_HANDLER"}
        self.undo_handlers[handler](json.loads(row["undo_payload"] or "{}"))
        with self._connect() as db:
            db.execute("UPDATE runs SET undone_at=? WHERE id=?",(_now().isoformat(),run_id)); self._audit(db,"AUTOMATION_UNDONE",{"run_id":run_id})
        return {"status":"undone","run_id":run_id}
    def history(self,limit=50):
        if not 1<=limit<=500: raise ValueError("INVALID_HISTORY_LIMIT")
        with self._connect() as db: rows=db.execute("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?",(limit,)).fetchall()
        return [dict(r) for r in rows]
    def audit_events(self,limit=100):
        if not 1<=limit<=1000: raise ValueError("INVALID_AUDIT_LIMIT")
        with self._connect() as db: rows=db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT ?",(limit,)).fetchall()
        return [dict(r) for r in rows]
