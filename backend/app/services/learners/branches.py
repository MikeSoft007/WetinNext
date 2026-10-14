"""Optional goal-scoped side quests; never alter the four-week plan."""

import json
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.contracts.schemas import LearningBranchRequest, LearningBranchUpdate
from app.core.clients import get_catalog_resources
from .database import db
from .dependencies import learner
from .goals import goal_id
from .models import Learner, LearningBranch

router = APIRouter(tags=["Learning branches"])


def records(row, session):
    return session.scalars(
        select(LearningBranch).where(
            LearningBranch.learner_id == row.id, LearningBranch.goal_id == goal_id(row)
        )
    ).all()


@router.get("/me/branches")
def read(row: Learner = Depends(learner), session: Session = Depends(db)):
    return [dict(id=r.id, **json.loads(r.payload)) for r in records(row, session)]


@router.post("/me/branches")
def create(
    body: LearningBranchRequest,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    plan = json.loads(row.plan) or {}
    if not plan:
        raise HTTPException(409, "Create your goal plan first.")
    if len(records(row, session)) >= 12:
        raise HTTPException(409, "Keep up to twelve side quests per goal.")
    allowed = {week.get("resource_id") for week in plan.get("weeks", [])}
    sources = plan.get("resources") or [
        r for r in get_catalog_resources() if r["id"] in allowed
    ]
    resource = next((r for r in sources if r["id"] == body.resource_id), None)
    if body.resource_id and not resource:
        raise HTTPException(422, "Choose a resource from this goal's plan.")
    payload = dict(
        title=body.title.strip(),
        task=body.task.strip(),
        resource=resource,
        completed=False,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    if not payload["title"] or not payload["task"]:
        raise HTTPException(422, "Add a title and a practice task.")
    record = LearningBranch(
        id=uuid4().hex,
        learner_id=row.id,
        goal_id=goal_id(row),
        payload=json.dumps(payload),
    )
    session.add(record)
    session.commit()
    return dict(id=record.id, **payload)


@router.patch("/me/branches/{branch_id}")
def update(
    branch_id: str,
    body: LearningBranchUpdate,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    record = session.get(LearningBranch, branch_id)
    if not record or record.learner_id != row.id or record.goal_id != goal_id(row):
        raise HTTPException(404, "Branch not found for this goal.")
    payload = dict(**json.loads(record.payload))
    payload["completed"] = body.completed
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    record.payload = json.dumps(payload)
    session.commit()
    return dict(id=record.id, **payload)
