"""Multiple goal workspaces with the existing learner row as active projection."""

import hashlib, json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from .models import GoalWorkspace, PlanRevision, Learner
from .database import db
from .dependencies import learner

router = APIRouter()


def goal_id(row, goal=None):
    text = goal if goal is not None else json.loads(row.profile).get("goal", "")
    return (
        hashlib.sha256(
            (row.id + "|" + " ".join(text.casefold().split())).encode()
        ).hexdigest()[:32]
        if text
        else None
    )


def store_snapshot(row, session, data):
    goal = data.get("profile", {}).get("goal")
    if not goal:
        return
    gid = goal_id(row, goal)
    record = session.get(GoalWorkspace, gid)
    stamp = datetime.now(timezone.utc).isoformat()
    if record:
        record.payload = json.dumps(data)
        record.updated_at = stamp
    else:
        session.add(
            GoalWorkspace(
                id=gid, learner_id=row.id, updated_at=stamp, payload=json.dumps(data)
            )
        )
    session.flush()


def save_current(row, session):
    store_snapshot(
        row,
        session,
        {
            key: json.loads(getattr(row, key))
            for key in ["profile", "plan", "progress", "applications"]
        },
    )


def recover_history(row, session):
    save_current(row, session)
    revisions = [
        json.loads(r.payload)
        for r in session.scalars(
            select(PlanRevision).where(PlanRevision.learner_id == row.id)
        )
    ]
    revisions.sort(key=lambda r: r.get("at", r.get("revised_at", "")), reverse=True)
    for data in revisions:
        goal = data.get("profile", {}).get("goal")
        if goal and not session.get(GoalWorkspace, goal_id(row, goal)):
            store_snapshot(
                row,
                session,
                {
                    "profile": data["profile"],
                    "plan": data.get("plan"),
                    "progress": data.get("progress", {}),
                    "applications": data.get("applications", {}),
                },
            )


@router.get("/me/goals")
def goals(row: Learner = Depends(learner), session: Session = Depends(db)):
    recover_history(row, session)
    session.commit()
    active = goal_id(row)
    records = session.scalars(
        select(GoalWorkspace)
        .where(GoalWorkspace.learner_id == row.id)
        .order_by(GoalWorkspace.updated_at.desc())
    ).all()
    result = []
    for record in records:
        data = json.loads(record.payload)
        result.append(
            {
                "id": record.id,
                "goal": data["profile"]["goal"],
                "country": data["profile"].get("country"),
                "active": record.id == active,
                "has_plan": bool(data.get("plan")),
                "completed_weeks": sum(
                    p.get("status") == "done" for p in data.get("progress", {}).values()
                ),
                "updated_at": record.updated_at,
            }
        )
    return result


@router.post("/me/goals/{gid}/activate")
def activate(gid: str, row: Learner = Depends(learner), session: Session = Depends(db)):
    record = session.get(GoalWorkspace, gid)
    if not record or record.learner_id != row.id:
        raise HTTPException(404, "Goal not found.")
    if gid == goal_id(row):
        return {"saved": True}
    save_current(row, session)
    data = json.loads(record.payload)
    account_name = json.loads(row.profile).get("name")
    if account_name:
        data["profile"]["name"] = account_name
    for key in ["profile", "plan", "progress", "applications"]:
        setattr(row, key, json.dumps(data.get(key, {} if key != "plan" else None)))
    record.updated_at = datetime.now(timezone.utc).isoformat()
    session.commit()
    return {"saved": True}


@router.delete("/me/goals/{gid}")
def delete_goal(
    gid: str, row: Learner = Depends(learner), session: Session = Depends(db)
):
    from sqlalchemy import delete
    from .models import (
        WeekWork,
        AssessmentAttempt,
        GoalReminder,
        LearningPick,
        LearningBranch,
    )

    recover_history(row, session)
    record = session.get(GoalWorkspace, gid)
    if not record or record.learner_id != row.id:
        raise HTTPException(404, "Goal not found.")
    snapshot = json.loads(record.payload)
    title = snapshot["profile"]["goal"]
    sprint_ids = {snapshot.get("plan", {}).get("id")} if snapshot.get("plan") else set()
    # Remove revisions too, otherwise history recovery would resurrect this goal.
    for revision in session.scalars(
        select(PlanRevision).where(PlanRevision.learner_id == row.id)
    ).all():
        data = json.loads(revision.payload)
        if goal_id(row, data.get("profile", {}).get("goal", "")) == gid:
            if data.get("plan"):
                sprint_ids.add(data["plan"].get("id"))
            session.delete(revision)
    for model in [GoalReminder, LearningPick, LearningBranch]:
        session.execute(
            delete(model).where(model.learner_id == row.id, model.goal_id == gid)
        )
    session.execute(
        delete(AssessmentAttempt).where(
            AssessmentAttempt.learner_id == row.id, AssessmentAttempt.goal == title
        )
    )
    if sprint_ids:
        session.execute(
            delete(WeekWork).where(
                WeekWork.learner_id == row.id, WeekWork.sprint_id.in_(sprint_ids)
            )
        )
    if goal_id(row) == gid:
        replacement = session.scalars(
            select(GoalWorkspace)
            .where(GoalWorkspace.learner_id == row.id, GoalWorkspace.id != gid)
            .order_by(GoalWorkspace.updated_at.desc())
        ).first()
        if replacement:
            data = json.loads(replacement.payload)
            data["profile"]["name"] = json.loads(row.profile).get("name", "")
            for key in ["profile", "plan", "progress", "applications"]:
                setattr(
                    row, key, json.dumps(data.get(key, None if key == "plan" else {}))
                )
        else:
            profile = json.loads(row.profile)
            profile["goal"] = ""
            profile["career_track"] = "auto"
            row.profile = json.dumps(profile)
            row.plan, row.progress, row.applications = "null", "{}", "{}"
    session.delete(record)
    session.commit()
    return {"deleted": True, "active_goal_id": goal_id(row)}
