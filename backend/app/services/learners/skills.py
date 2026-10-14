import json
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.skills import skills_in, track_for, TRACKS
from app.core.clients import get_catalog_resources
from .dependencies import learner
from .database import db
from .models import Learner, WeekWork

router = APIRouter()


@router.get("/me/skills")
def skills(row: Learner = Depends(learner), session: Session = Depends(db)):
    profile = json.loads(row.profile)
    plan = json.loads(row.plan) or {}
    progress = json.loads(row.progress)
    resources = plan.get("resources", [])
    if not resources and plan.get("weeks"):
        resources = get_catalog_resources()
    lookup = {r["id"]: r for r in resources}
    target = set(skills_in(profile.get("goal", "")))
    if track_for(profile) != "foundation":
        target.update(TRACKS[track_for(profile)]["skills"])
    if plan.get("research_id"):
        target.update(skill for r in resources for skill in r.get("skills", []))
    records = session.scalars(
        select(WeekWork).where(
            WeekWork.learner_id == row.id, WeekWork.sprint_id == plan.get("id", "")
        )
    ).all()
    evidence = {
        r.week
        for r in records
        if json.loads(r.payload).get("learning_note")
        or json.loads(r.payload).get("practice_example")
        or json.loads(r.payload).get("reflection")
        or json.loads(r.payload).get("evidence_url")
    }
    coverage = {}
    for week in plan.get("weeks", []):
        detected = (
            set(skills_in(" ".join([week["title"], week["task"], week["success"]])))
            & target
        )
        subjects = (
            detected
            or set(lookup.get(week["resource_id"], {}).get("skills", [])) & target
        )
        for subject in subjects:
            coverage.setdefault(subject, []).append(week["week"])
    return {
        "goal": profile.get("goal", ""),
        "skills": [
            {
                "name": name,
                "planned_weeks": weeks,
                "practised_weeks": [
                    w for w in weeks if progress.get(str(w), {}).get("status") == "done"
                ],
                "evidence_count": len(set(weeks) & evidence),
                "next_week": next(
                    (
                        w
                        for w in weeks
                        if progress.get(str(w), {}).get("status") != "done"
                    ),
                    None,
                ),
            }
            for name, weeks in sorted(coverage.items())
        ],
        "notice": "Practice and evidence are self-reported learning signals, not verified proficiency.",
    }
