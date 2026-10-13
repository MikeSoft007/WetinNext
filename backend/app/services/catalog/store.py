"""Catalogue-owned persistence, with a transactionally recorded audit trail."""

from contextlib import contextmanager
import sqlite3
import json
from datetime import datetime, timezone
from app.core.config import settings
from .seed import RESOURCES, OPPORTUNITIES
from app.core.learning import enrich_resource


@contextmanager
def connect():
    db = sqlite3.connect(settings.catalog_database, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute(
        "CREATE TABLE IF NOT EXISTS content (kind TEXT, id TEXT, status TEXT, payload TEXT, updated_at TEXT, PRIMARY KEY(kind,id))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, kind TEXT, content_id TEXT, at TEXT)"
    )
    for kind, items in [("resources", RESOURCES), ("opportunities", OPPORTUNITIES)]:
        for item in items:
            db.execute(
                "INSERT OR IGNORE INTO content VALUES (?,?,?,?,?)",
                (kind, item["id"], "published", json.dumps(item), now()),
            )
    db.commit()
    try:
        with db:
            yield db
    finally:
        db.close()


def now():
    return datetime.now(timezone.utc).isoformat()


def items(kind, public=True):
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM content WHERE kind=?"
            + (" AND status='published'" if public else "")
            + " ORDER BY updated_at DESC, id ASC",
            (kind,),
        ).fetchall()
    results = [
        (
            freshness(json.loads(r["payload"]))
            if public
            else {
                **json.loads(r["payload"]),
                "status": r["status"],
                "updated_at": r["updated_at"],
            }
        )
        for r in rows
    ]
    return [enrich_resource(r) for r in results] if kind == "resources" else results


def save(kind, item, status):
    item = {**item, "publication_mode": "manual"}
    with connect() as db:
        db.execute(
            "INSERT INTO content VALUES (?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at",
            (kind, item["id"], status, json.dumps(item), now()),
        )
        db.execute(
            "INSERT INTO audit(action,kind,content_id,at) VALUES (?,?,?,?)",
            ("save:" + status, kind, item["id"], now()),
        )
    return {**item, "status": status}


def freshness(item):
    """Known deadline expiry is evaluated at read time, even if imports are paused."""
    from datetime import date

    if (
        not item.get("sample")
        and item.get("deadline")
        and item["deadline"] < date.today().isoformat()
    ):
        return {
            **item,
            "availability": "closed",
            "last_check_result": "Application deadline has passed",
        }
    return item
