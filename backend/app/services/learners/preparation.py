"""Goal preparation signals and persisted in-app focus reminders."""

import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import db
from .dependencies import learner
from .models import (
    Learner,
    GoalWorkspace,
    GoalReminder,
    WeekWork,
    AssessmentAttempt,
    CVReview,
)
from .goals import recover_history, goal_id

router = APIRouter()
from app.contracts.schemas import ReminderSettings


def reminder(row, session, gid):
    record = session.get(GoalReminder, (row.id, gid))
    data = (
        json.loads(record.payload)
        if record
        else ReminderSettings(
            timezone="Africa/Lagos"
            if json.loads(row.profile).get("country") == "Nigeria"
            else "Africa/Kigali"
        ).model_dump()
    )
    now = datetime.now(timezone.utc).astimezone(ZoneInfo(data["timezone"]))
    hour, minute = map(int, data["time"].split(":"))
    schedule = [
        (now - timedelta(days=i)).replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        for i in range(7)
    ]
    due = next(
        (at for at in schedule if at.weekday() in data["days"] and at <= now), None
    )
    ack = (
        datetime.fromisoformat(data["acknowledged_at"])
        if data.get("acknowledged_at")
        else None
    )
    return {
        **data,
        "due": bool(data["enabled"] and due and (not ack or due > ack)),
        "delivery": "in_app",
    }


@router.get("/me/preparation")
def overview(row: Learner = Depends(learner), session: Session = Depends(db)):
    recover_history(row, session)
    session.commit()
    goals = session.scalars(
        select(GoalWorkspace)
        .where(GoalWorkspace.learner_id == row.id)
        .order_by(GoalWorkspace.updated_at.desc())
    ).all()
    work = session.scalars(select(WeekWork).where(WeekWork.learner_id == row.id)).all()
    quizzes = session.scalars(
        select(AssessmentAttempt).where(AssessmentAttempt.learner_id == row.id)
    ).all()
    cvs = [
        json.loads(r.payload)
        for r in session.scalars(select(CVReview).where(CVReview.learner_id == row.id))
    ]
    results = []
    for record in goals:
        data = json.loads(record.payload)
        profile = data["profile"]
        plan = data.get("plan") or {}
        progress = data.get("progress", {})
        evidence = sum(
            bool(
                (w := json.loads(r.payload)).get("reflection") or w.get("evidence_url")
            )
            for r in work
            if r.sprint_id == plan.get("id")
        )
        practice = next(
            (
                json.loads(q.payload).get("result")
                for q in sorted(quizzes, key=lambda q: q.created_at, reverse=True)
                if q.goal == profile["goal"]
                and q.sprint_id == plan.get("id")
                and json.loads(q.payload).get("result")
            ),
            None,
        )
        weeks = [
            {
                "week": w["week"],
                "title": w["title"],
                "done": progress.get(str(w["week"]), {}).get("status") == "done",
            }
            for w in plan.get("weeks", [])
        ]
        signals = [
            {"label": "Plan", "done": bool(plan)},
            {"label": "Practice", "done": any(w["done"] for w in weeks)},
            {"label": "Evidence", "done": evidence > 0},
            {"label": "Quiz", "done": bool(practice)},
            {"label": "CV", "done": any(c.get("goal") == profile["goal"] for c in cvs)},
        ]
        focus = next(
            (s["label"] for s in signals if not s["done"]),
            "Review opportunity requirements",
        )
        results.append(
            {
                "id": record.id,
                "goal": profile["goal"],
                "active": record.id == goal_id(row),
                "signals": signals,
                "completed_signals": sum(s["done"] for s in signals),
                "weeks": weeks,
                "evidence_count": evidence,
                "practice": {"correct": practice["correct"], "total": practice["total"]}
                if practice
                else None,
                "next_focus": focus,
                "reminder": reminder(row, session, record.id),
            }
        )
    return {
        "goals": results,
        "notice": "Preparation signals reflect recorded activity, not verified mastery or job eligibility.",
    }


@router.get("/me/reminders")
def read(row: Learner = Depends(learner), session: Session = Depends(db)):
    gid = goal_id(row)
    if not gid:
        raise HTTPException(409, "Add a goal first.")
    return reminder(row, session, gid)


@router.put("/me/reminders")
def save(
    body: ReminderSettings,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    gid = goal_id(row)
    if not gid:
        raise HTTPException(409, "Add a goal first.")
    record = session.get(GoalReminder, (row.id, gid))
    data = body.model_dump()
    if record:
        record.payload = json.dumps(data)
    else:
        session.add(
            GoalReminder(learner_id=row.id, goal_id=gid, payload=json.dumps(data))
        )
    session.commit()
    return reminder(row, session, gid)


@router.post("/me/reminders/acknowledge")
def acknowledge(row: Learner = Depends(learner), session: Session = Depends(db)):
    gid = goal_id(row)
    record = session.get(GoalReminder, (row.id, gid)) if gid else None
    if not record:
        raise HTTPException(409, "Save reminder settings first.")
    data = json.loads(record.payload)
    data["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    record.payload = json.dumps(data)
    session.commit()
    return {"saved": True}
