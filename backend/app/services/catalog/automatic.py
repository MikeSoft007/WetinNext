"""One catalogue-owned refresh loop; the database cooldown also protects replicas."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.admin import require_admin
from app.core.config import settings
from .store import connect
from . import publication
from .ingestion import PROVIDERS, init, sync, check_jobicy_links

router = APIRouter(tags=["Source ingestion"], dependencies=[Depends(require_admin)])


def configuration():
    with connect() as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS source_settings (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL)"
        )
        row = db.execute("SELECT enabled FROM source_settings WHERE id=1").fetchone()
    return {
        "enabled": bool(row["enabled"]) if row else settings.auto_ingest,
        "interval_hours": max(1, settings.source_refresh_hours),
        "auto_publish": publication.enabled(),
    }


@router.get("/admin/source-settings")
def get_settings():
    return configuration()


class AutomaticUpdate(BaseModel):
    enabled: bool
    auto_publish: bool | None = None


@router.put("/admin/source-settings")
def update_settings(data: AutomaticUpdate):
    configuration()
    with connect() as db:
        db.execute(
            "INSERT INTO source_settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled",
            (int(data.enabled),),
        )
    if data.auto_publish is not None:
        publication.set_enabled(data.auto_publish)
        publication.publish_qualified()
    return configuration()


def run_due():
    config = configuration()
    publication.publish_qualified()
    if not config["enabled"]:
        return
    with connect() as db:
        init(db)
        attempts = {
            row["source"]: row["attempted_at"]
            for row in db.execute("SELECT source,attempted_at FROM source_runs")
        }
    cutoff = datetime.now(timezone.utc) - timedelta(hours=config["interval_hours"])
    for provider in PROVIDERS:
        if provider == "reliefweb" and not settings.reliefweb_appname:
            continue
        provider_cutoff = (
            min(cutoff, datetime.now(timezone.utc) - timedelta(hours=6))
            if provider == "remotive"
            else cutoff
        )
        if (
            provider in attempts
            and datetime.fromisoformat(attempts[provider]) > provider_cutoff
        ):
            continue
        try:
            sync(provider)
        except HTTPException as exc:
            logging.getLogger(__name__).info(
                "Source refresh %s returned %s", provider, exc.status_code
            )
        except Exception:
            logging.getLogger(__name__).exception(
                "Source refresh failed for %s", provider
            )


async def refresh_loop():
    while True:
        try:
            await asyncio.to_thread(run_due)
        except Exception:
            logging.getLogger(__name__).exception("Automatic refresh cycle failed")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(refresh_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
