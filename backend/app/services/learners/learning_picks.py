"""Remember source-backed reading choices per goal and market."""

import hashlib, json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.contracts.schemas import LearningPickRequest, LearningPickUpdate
from app.core.clients import service_call
from .dependencies import learner
from .database import db
from .goals import goal_id
from .models import Learner, LearningPick

router = APIRouter()


@router.get("/me/learning-picks")
def read(
    market: str = "Nigeria",
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    records = session.scalars(
        select(LearningPick).where(
            LearningPick.learner_id == row.id, LearningPick.goal_id == goal_id(row)
        )
    ).all()
    return sorted(
        [
            {"id": r.id, **json.loads(r.payload)}
            for r in records
            if json.loads(r.payload).get("market") == market
        ],
        key=lambda r: r["updated_at"],
        reverse=True,
    )


@router.post("/me/learning-picks")
async def save(
    body: LearningPickRequest,
    request: Request,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    result = (
        await service_call("matching", f"/research/{body.research_id}", request)
    ).json()
    guide = result.get("result") or {}
    if result.get("status") != "complete" or guide.get("goal") != json.loads(
        row.profile
    ).get("goal"):
        raise HTTPException(409, "Choose a resource from your current goal guide.")
    source = next(
        (r for r in guide.get("resources", []) if r["id"] == body.resource_id), None
    )
    if not source:
        raise HTTPException(404, "Learning source not found in this guide.")
    market = guide.get("market") or next(
        (m for m in ["Nigeria", "Rwanda"] if m in guide.get("location", "")), "Global"
    )
    pid = hashlib.sha256(
        f"{row.id}|{goal_id(row)}|{market}|{source['url']}".encode()
    ).hexdigest()[:32]
    existing = session.get(LearningPick, pid)
    if existing:
        return {"id": pid, **json.loads(existing.payload)}
    records = session.scalars(
        select(LearningPick).where(
            LearningPick.learner_id == row.id, LearningPick.goal_id == goal_id(row)
        )
    ).all()
    if len(records) >= 50:
        raise HTTPException(409, "This goal already has 50 saved learning picks.")
    data = {k: source[k] for k in ["title", "url", "provider", "format", "skill"]}
    data.update(
        market=market, status="saved", updated_at=datetime.now(timezone.utc).isoformat()
    )
    session.add(
        LearningPick(
            id=pid, learner_id=row.id, goal_id=goal_id(row), payload=json.dumps(data)
        )
    )
    session.commit()
    return {"id": pid, **data}


@router.patch("/me/learning-picks/{pid}")
def update(
    pid: str,
    body: LearningPickUpdate,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    record = session.get(LearningPick, pid)
    if not record or record.learner_id != row.id or record.goal_id != goal_id(row):
        raise HTTPException(404, "Saved learning pick not found.")
    data = json.loads(record.payload)
    data.update(status=body.status, updated_at=datetime.now(timezone.utc).isoformat())
    record.payload = json.dumps(data)
    session.commit()
    return {"id": pid, **data}
