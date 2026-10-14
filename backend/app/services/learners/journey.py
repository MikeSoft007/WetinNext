"""A factual, owner-scoped activity journal for the active goal and sprint."""

import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import db
from .dependencies import learner
from .goals import goal_id
from .models import (
    Learner,
    WeekWork,
    CheckInEvent,
    AssessmentAttempt,
    CVReview,
    LearningBranch,
)

router = APIRouter(tags=["Career journey"])


@router.get("/me/journey")
def journey(
    page: int = Query(default=1, ge=1),
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    goal = json.loads(row.profile).get("goal", "")
    plan = json.loads(row.plan) or {}
    events = []

    def add(kind, title, stamp, status, target):
        events.append(
            {
                "kind": kind,
                "title": title,
                "at": stamp or "",
                "status": status,
                "target": target,
            }
        )

    for record in session.scalars(
        select(WeekWork).where(
            WeekWork.learner_id == row.id, WeekWork.sprint_id == plan.get("id", "")
        )
    ):
        payload = json.loads(record.payload)
        proof = bool(
            payload.get("learning_note")
            or payload.get("reflection")
            or payload.get("practice_example")
            or payload.get("evidence_url")
        )
        add(
            "work",
            f"Week {record.week} work saved",
            payload.get("updated_at"),
            "Evidence recorded" if proof else "Actions recorded",
            "/app/progress?view=plan",
        )
    for record in session.scalars(
        select(CheckInEvent).where(CheckInEvent.learner_id == row.id)
    ):
        payload = json.loads(record.payload)
        if payload.get("goal_id") == goal_id(row):
            add(
                "check-in",
                f"Week {payload.get('week')} check-in",
                payload.get("updated_at"),
                payload.get("status", "Recorded"),
                "/app/progress",
            )
    for record in session.scalars(
        select(AssessmentAttempt).where(
            AssessmentAttempt.learner_id == row.id,
            AssessmentAttempt.goal == goal,
            AssessmentAttempt.sprint_id == plan.get("id", ""),
        )
    ):
        payload = json.loads(record.payload)
        if payload.get("result"):
            add(
                "practice",
                "Practice check completed",
                record.created_at,
                "Result saved",
                "/app/progress?view=practice",
            )
    for record in session.scalars(
        select(CVReview).where(CVReview.learner_id == row.id)
    ):
        if json.loads(record.payload).get("goal") == goal:
            add(
                "review",
                "Experience compared with your goal",
                record.created_at,
                "Review saved",
                "/app/review",
            )
    for record in session.scalars(
        select(LearningBranch).where(
            LearningBranch.learner_id == row.id, LearningBranch.goal_id == goal_id(row)
        )
    ):
        payload = json.loads(record.payload)
        add(
            "branch",
            payload["title"],
            payload.get("updated_at"),
            "Completed" if payload.get("completed") else "In progress",
            "/app/progress",
        )
    events.sort(key=lambda item: item["at"], reverse=True)
    return {
        "goal": goal,
        "total": len(events),
        "page": page,
        "items": events[(page - 1) * 10 : page * 10],
        "notice": "Recorded activity and self-reported evidence, not verified professional competence.",
    }
