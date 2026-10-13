"""Learner-owned preparation and application journal, separate from AI guidance."""

import json
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import select
from app.services.learners.models import OpportunityProgress
from app.core.clients import get_catalog_opportunity
from app.core import clients as catalog_client


def stamp():
    return datetime.now(timezone.utc).isoformat()


def record(row, session, oid):
    saved = session.get(OpportunityProgress, (row.id, oid))
    return saved, (
        json.loads(saved.payload)
        if saved
        else {"opportunity_id": oid, "checklist": {}, "notes": "", "history": []}
    )


def opportunity_snapshot(row, session, oid):
    saved, data = record(row, session, oid)
    try:
        opportunity = get_catalog_opportunity(oid)
    except HTTPException as exc:
        if exc.status_code != 404 or not data.get("opportunity"):
            raise
        opportunity = {**data["opportunity"], "availability": "closed"}
    data["opportunity"] = {
        k: opportunity.get(k)
        for k in [
            "id",
            "title",
            "organisation",
            "sample",
            "url",
            "deadline",
            "availability",
            "source",
        ]
    }
    return saved, data, opportunity


def save(row, session, oid, saved, data):
    from .goals import goal_id

    gid = goal_id(row)
    if gid:
        data["goal_ids"] = list(dict.fromkeys(data.get("goal_ids", []) + [gid]))
    data["updated_at"] = stamp()
    if saved:
        saved.payload = json.dumps(data)
    else:
        session.add(
            OpportunityProgress(
                learner_id=row.id, opportunity_id=oid, payload=json.dumps(data)
            )
        )
    session.commit()
    return data


def preparation(row, session, oid, update=None):
    saved, data, opportunity = opportunity_snapshot(row, session, oid)
    if update is None:
        return data
    action = update.action.strip()
    if not action:
        raise HTTPException(422, "Choose a preparation action.")
    if action not in data["checklist"] and len(data["checklist"]) >= 30:
        raise HTTPException(
            422, "This opportunity already has 30 saved preparation actions."
        )
    data["checklist"][action] = update.completed
    if not data.get("status"):
        data["status"] = json.loads(row.applications).get(oid, "preparing")
    applications = json.loads(row.applications)
    applications[oid] = data["status"]
    row.applications = json.dumps(applications)
    return save(row, session, oid, saved, data)


def application(row, session, oid, update):
    saved, data, opportunity = opportunity_snapshot(row, session, oid)
    if opportunity.get("sample") and update.status in [
        "applied",
        "interviewing",
        "offer",
        "rejected",
    ]:
        raise HTTPException(422, "Practice listings cannot receive real applications.")
    if (
        update.status == "applied"
        and (
            opportunity.get("availability") == "closed"
            or (opportunity.get("deadline") and opportunity["deadline"] < stamp()[:10])
        )
        and data.get("status") not in ["applied", "interviewing", "offer", "rejected"]
    ):
        raise HTTPException(
            422,
            "This listing has closed. Keep it for reference or choose another opportunity.",
        )
    previous = data.get("status") or json.loads(row.applications).get(oid)
    if previous != update.status:
        data["history"] = [
            *data.get("history", []),
            {"status": update.status, "at": stamp()},
        ][-50:]
    data["status"] = update.status
    if update.notes is not None:
        data["notes"] = update.notes.strip()
    applications = json.loads(row.applications)
    applications[oid] = update.status
    row.applications = json.dumps(applications)
    return save(row, session, oid, saved, data)


def applications(row, session):
    rows = session.scalars(
        select(OpportunityProgress).where(OpportunityProgress.learner_id == row.id)
    )
    records = {entry.opportunity_id: json.loads(entry.payload) for entry in rows}
    from .goals import goal_id

    gid = goal_id(row)
    if gid:
        records = {
            oid: data
            for oid, data in records.items()
            if gid in data.get("goal_ids", []) or oid in json.loads(row.applications)
        }
    for oid, status in json.loads(row.applications).items():
        if oid not in records:
            try:
                _, data, _ = opportunity_snapshot(row, session, oid)
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
                data = {
                    "opportunity_id": oid,
                    "opportunity": {"id": oid, "title": "Listing no longer available"},
                    "checklist": {},
                    "history": [],
                    "notes": "",
                }
            records[oid] = {**data, "status": status}
    if records:
        current = {
            item["id"]: item
            for item in catalog_client.get_catalog("/opportunities?include_closed=true")
        }
        for oid, data in records.items():
            if oid in current:
                data["opportunity"] = {
                    key: current[oid].get(key)
                    for key in [
                        "id",
                        "title",
                        "organisation",
                        "sample",
                        "url",
                        "deadline",
                        "availability",
                        "source",
                    ]
                }
            elif data.get("opportunity"):
                data["opportunity"] = {**data["opportunity"], "availability": "closed"}
    return sorted(records.values(), key=lambda r: r.get("updated_at", ""), reverse=True)
