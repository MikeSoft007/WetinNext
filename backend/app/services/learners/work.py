"""Private weekly work: actionable tasks and evidence, kept out of AI requests."""

import hashlib
import json
from datetime import datetime, timezone
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.clients import get_catalog_resources
from .database import db
from .dependencies import learner
from .models import Learner, WeekWork

router = APIRouter(tags=["Weekly work"])

from app.contracts.schemas import WorkUpdate


def sprint_id(row):
    plan = json.loads(row.plan) or {}
    if plan.get("id"):
        return plan["id"]
    # Legacy plans use a stable identity; newly created sprints receive a unique ID.
    profile = json.loads(row.profile)
    identity = {
        k: v for k, v in profile.items() if k not in ["hours", "device", "low_data"]
    }
    return hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()


def work_for(row, session, week):
    plan = json.loads(row.plan)
    task = next((w for w in (plan or {}).get("weeks", []) if w["week"] == week), None)
    if not task:
        raise HTTPException(404, "Create a sprint and choose a valid week.")
    key = (row.id, sprint_id(row), week)
    record = session.get(WeekWork, key)
    saved = json.loads(record.payload) if record else {}
    resources = (plan or {}).get("resources", [])
    if not resources:
        resources = get_catalog_resources()
    resource = next((r for r in resources if r["id"] == task["resource_id"]), None)
    actions = [
        {
            "id": "learn",
            "title": "Learn one useful idea",
            "detail": f"Open {resource['title'] if resource else 'the linked guide'}, choose an introductory section related to this task, and record one useful idea.",
        },
        {"id": "build", "title": "Put it into practice", "detail": task["task"]},
        {
            "id": "verify",
            "title": "Check and save your evidence",
            "detail": task["success"],
        },
    ]
    return record, {
        "week": week,
        "sprint_id": key[1],
        "title": task["title"],
        "resource": resource,
        "actions": actions,
        "checklist": saved.get("checklist", {}),
        "evidence_url": saved.get("evidence_url", ""),
        "reflection": saved.get("reflection", ""),
        "updated_at": saved.get("updated_at"),
        "coach_advice": json.loads(row.progress).get(str(week), {}).get("advice"),
    }


@router.get("/weeks/{week}/work")
def read(week: int, row: Learner = Depends(learner), session: Session = Depends(db)):
    return work_for(row, session, week)[1]


@router.put("/weeks/{week}/work")
def save(
    week: int,
    body: WorkUpdate,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    record, result = work_for(row, session, week)
    if set(body.checklist) - {a["id"] for a in result["actions"]}:
        raise HTTPException(422, "Choose the learning, practice or evidence action.")
    saved = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    if record:
        record.payload = json.dumps(saved)
    else:
        session.add(
            WeekWork(
                learner_id=row.id,
                sprint_id=result["sprint_id"],
                week=week,
                payload=json.dumps(saved),
            )
        )
    session.commit()
    return {**result, **saved}


@router.get("/me/portfolio")
def portfolio(row: Learner = Depends(learner), session: Session = Depends(db)):
    records = session.scalars(
        select(WeekWork)
        .where(WeekWork.learner_id == row.id, WeekWork.sprint_id == sprint_id(row))
        .order_by(WeekWork.week)
    ).all()
    return [{"week": record.week, **json.loads(record.payload)} for record in records]
