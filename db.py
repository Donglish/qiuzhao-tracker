import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "tracker.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company      TEXT NOT NULL,
  position     TEXT NOT NULL,
  city         TEXT NOT NULL DEFAULT '',
  channel      TEXT NOT NULL DEFAULT '',
  applied_date TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT '已投递',
  link         TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  event_time     TEXT NOT NULL,
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL
);
"""


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def query(sql, params=()):
    conn = get_conn()
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def execute(sql, params=()):
    conn = get_conn()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur
    finally:
        conn.close()


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def list_applications():
    apps = query("SELECT * FROM applications ORDER BY updated_at DESC")
    events = query("SELECT * FROM events ORDER BY event_time ASC")
    events_by_app = {}
    for e in events:
        events_by_app.setdefault(e["application_id"], []).append(e)
    for a in apps:
        a["events"] = events_by_app.get(a["id"], [])
    return apps
