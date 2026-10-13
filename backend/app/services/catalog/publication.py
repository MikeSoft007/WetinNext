"""Deterministic publication gates for approved imports, independent of AI."""

import json
import re
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from app.services.catalog.store import connect, now
from app.core.config import settings


def enabled():
    with connect() as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS publication_settings (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL)"
        )
        row = db.execute(
            "SELECT enabled FROM publication_settings WHERE id=1"
        ).fetchone()
    return bool(row["enabled"]) if row else settings.auto_publish


def set_enabled(value):
    enabled()
    with connect() as db:
        db.execute(
            "INSERT INTO publication_settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled",
            (int(value),),
        )


def rejection(kind, item):
    if item.get("publication_mode") == "manual":
        return "Manually managed; review required"
    if not item.get("title", "").strip():
        return "Missing title"
    link = urlparse(item.get("url") or "")
    try:
        port = link.port
    except ValueError:
        return "Invalid source URL"
    if link.scheme != "https" or link.username or port not in [None, 443]:
        return "Invalid source URL"
    if kind == "resources":
        if (
            item.get("source") != "freeCodeCamp"
            or not item.get("id", "").startswith("fcc-")
            or link.hostname != "www.freecodecamp.org"
            or not link.path.startswith("/learn/")
        ):
            return "Resource source needs review"
        if (
            item.get("cost") != "Free"
            or not item.get("skills")
            or item.get("device") != "laptop"
        ):
            return "Resource access or skills need review"
        return None
    if item.get("source") == "HEC Rwanda":
        return "Scholarship eligibility and deadline require PDF review"
    source = {
        "Jobicy": ("jobicy-", "jobicy.com"),
        "Remotive": ("remotive-", "remotive.com"),
        "ReliefWeb": ("reliefweb-", "reliefweb.int"),
    }.get(item.get("source"))
    if (
        not source
        or not item.get("id", "").startswith(source[0])
        or link.hostname != source[1]
    ):
        return "Job source needs review"
    if item.get("source") == "ReliefWeb" and re.search(
        r"\b(?:[3-9]|\d{2,})\s*(?:-|to|years?)", item.get("seniority") or "", re.I
    ):
        return "Experience requirements need editorial review"
    if item.get("sample") or not item.get("organisation") or not item.get("skills"):
        return "Incomplete job facts"
    if item.get("country") not in ["Nigeria", "Rwanda", "Global"]:
        return "Outside supported markets"
    if item.get("availability") != "listed":
        return "Current source listing not confirmed"
    try:
        if datetime.fromisoformat(item.get("source_seen_at", "")) < datetime.now(
            timezone.utc
        ) - timedelta(hours=24):
            return "Source observation is stale"
    except (ValueError, TypeError):
        return "Missing source observation"
    if item.get("deadline") and item["deadline"] < now()[:10]:
        return "Deadline passed"
    if re.search(
        r"\b(senior|lead|head|director|principal|staff)\b",
        item.get("title", "") + " " + (item.get("seniority") or ""),
        re.I,
    ):
        return "Seniority needs editorial review"
    return None


def publish_qualified():
    if not enabled():
        return 0
    count = 0
    with connect() as db:
        for row in db.execute("SELECT * FROM content WHERE status='draft'").fetchall():
            item = json.loads(row["payload"])
            # Older explicit editorial saves are respected as well as the new flag.
            manual = db.execute(
                "SELECT 1 FROM audit WHERE kind=? AND content_id=? AND action LIKE 'save:%' LIMIT 1",
                (row["kind"], row["id"]),
            ).fetchone()
            reason = (
                "Manually managed; review required"
                if manual
                else rejection(row["kind"], item)
            )
            item["publication_note"] = (
                reason
                or "Approved source import passed automatic checks; eligibility still requires source confirmation"
            )
            if reason:
                db.execute(
                    "UPDATE content SET payload=? WHERE kind=? AND id=?",
                    (json.dumps(item), row["kind"], row["id"]),
                )
                continue
            item["publication_mode"] = "automatic"
            if row["kind"] == "opportunities" and not item.get("deadline"):
                item["deadline_unknown_confirmed"] = True
                item["publication_note"] += "; source does not provide a closing date"
            db.execute(
                "UPDATE content SET status='published',payload=?,updated_at=? WHERE kind=? AND id=?",
                (json.dumps(item), now(), row["kind"], row["id"]),
            )
            db.execute(
                "INSERT INTO audit(action,kind,content_id,at) VALUES (?,?,?,?)",
                ("publish:automatic", row["kind"], row["id"], now()),
            )
            count += 1
    return count
