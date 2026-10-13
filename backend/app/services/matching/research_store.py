"""Matching-owned durable research. Completed guides stay until learner erasure."""

import json
import sqlite3
import time
from pathlib import Path
from contextlib import contextmanager
from app.core.config import settings


@contextmanager
def connection():
    with sqlite3.connect(settings.research_database, timeout=10) as db:
        try:
            Path(settings.research_database).chmod(0o600)
        except OSError:
            pass
        db.row_factory = sqlite3.Row
        db.execute(
            "CREATE TABLE IF NOT EXISTS research_guides (id TEXT PRIMARY KEY, owner TEXT NOT NULL, cache_key TEXT NOT NULL, goal TEXT NOT NULL, market TEXT NOT NULL, updated REAL NOT NULL, payload TEXT NOT NULL)"
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS research_owner ON research_guides(owner,updated)"
        )
        yield db


def save(jid, job):
    if job.get("deleted"):
        return
    data = {k: v for k, v in job.items() if k not in {"task", "expires", "deleted"}}
    with connection() as db:
        db.execute(
            "INSERT OR REPLACE INTO research_guides VALUES (?,?,?,?,?,?,?)",
            (
                jid,
                job["owner"],
                job["key"],
                job.get("profile", {}).get("goal")
                or (job.get("result") or {}).get("goal", ""),
                job.get("market", ""),
                time.time(),
                json.dumps(data),
            ),
        )


def get(jid, owner):
    with connection() as db:
        row = db.execute(
            "SELECT payload FROM research_guides WHERE id=? AND owner=?", (jid, owner)
        ).fetchone()
    return json.loads(row["payload"]) if row else None


def latest(owner, goal, market):
    with connection() as db:
        row = db.execute(
            "SELECT id,payload FROM research_guides WHERE owner=? AND goal=? AND market=? ORDER BY updated DESC LIMIT 1",
            (owner, goal, market),
        ).fetchone()
    return (row["id"], json.loads(row["payload"])) if row else None


def erase(owner):
    with connection() as db:
        db.execute("DELETE FROM research_guides WHERE owner=?", (owner,))
