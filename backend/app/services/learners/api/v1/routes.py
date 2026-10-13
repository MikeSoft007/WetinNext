import json
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app.core.config import settings
from app.contracts.schemas import Profile, CheckIn, ApplicationUpdate, ProfileAdjustment
from app.core.clients import get_catalog_opportunity
from app.services.learners.models import Learner
from app.services.learners.database import db
from app.services.learners.dependencies import learner
from app.services.learners.pathways import generate

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "demo_mode": settings.demo_mode,
        "ai_configured": bool(settings.openai_api_key and settings.openai_model),
    }


@router.post("/demo/session")
def demo_session(request: Request, response: Response):
    if not settings.demo_mode:
        raise HTTPException(404)
    if request.headers.get("origin") and request.headers["origin"] not in [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]:
        raise HTTPException(403, "Local demo only.")
    if not request.cookies.get("wetinnext_demo"):
        response.set_cookie(
            "wetinnext_demo",
            secrets.token_hex(32),
            httponly=True,
            samesite="strict",
            max_age=60 * 60 * 24 * 7,
        )
    return {"mode": "local demo"}


@router.get("/me")
def me(row: Learner = Depends(learner), session: Session = Depends(db)):
    result = {
        k: json.loads(getattr(row, k))
        for k in ["profile", "plan", "progress", "applications"]
    }
    from app.core.skills import track_for

    profile = result["profile"]
    result["needs_goal_research"] = bool(
        profile.get("goal")
        and profile.get("career_track", "auto") == "auto"
        and track_for(profile) == "foundation"
        and not (result["plan"] or {}).get("research_id")
    )
    from app.services.learners.goals import goal_id

    result["goal_id"] = goal_id(row)
    result["metrics"] = {
        "weekly_streak": weekly_streak(
            history(row, session),
            zone=(
                "Africa/Lagos"
                if result["profile"].get("country") == "Nigeria"
                else "Africa/Kigali"
            ),
        )
    }
    return result


@router.put("/me/profile")
def update_profile(
    profile: Profile, row: Learner = Depends(learner), session: Session = Depends(db)
):
    if json.loads(row.plan) is not None:
        raise HTTPException(
            409,
            "Reset your pathway before replacing the profile in this first version.",
        )
    saved_name = json.loads(row.profile).get("name")
    if saved_name:
        profile = profile.model_copy(update={"name": saved_name})
    row.profile = profile.model_dump_json()
    from sqlalchemy import select
    from app.services.learners.models import CVReview

    latest = session.scalars(
        select(CVReview)
        .where(CVReview.learner_id == row.id)
        .order_by(CVReview.created_at.desc())
        .limit(1)
    ).first()
    cv_skills = json.loads(latest.payload).get("skills", []) if latest else []
    from app.core.skills import track_for

    # Unsupported careers must enter goal research, not an unrelated digital sprint.
    unsupported = (
        profile.career_track == "auto"
        and track_for(profile.model_dump()) == "foundation"
    )
    row.plan = (
        "null"
        if unsupported
        else json.dumps(generate(profile.model_dump(), cv_skills=cv_skills))
    )
    session.commit()
    return {"saved": True}


@router.post("/weeks/{week}/check-in")
def check_in(
    week: int,
    data: CheckIn,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    if not 1 <= week <= 4 or json.loads(row.plan) is None:
        raise HTTPException(404, "Week not found.")
    progress = json.loads(row.progress)
    existing = progress.get(str(week), {})
    if existing.get("status") == "done" and data.status != "done":
        raise HTTPException(409, "Completed work is preserved.")
    if any(progress.get(str(i), {}).get("status") != "done" for i in range(1, week)):
        raise HTTPException(409, "Complete the previous weeks first.")
    task = next(w for w in json.loads(row.plan)["weeks"] if w["week"] == week)
    if data.status == "done":
        advice = (
            "Your sprint is complete. Review your saved evidence and use it in your CV."
            if week == 4
            else f"Week {week} is saved. Week {week + 1} is ready; keep your project evidence as you continue."
        )
    elif data.status == "more-time":
        session_minutes = max(1, (task["minutes"] + 1) // 2)
        advice = f"For “{task['title']}”, try two sessions of about {session_minutes} minutes. Use the first to learn and practise, and the second to check: {task['success']} Your completed work stays saved."
    else:
        advice = f"Start “{task['title']}” with ten minutes and one small example. Save what you tried, then compare it with: {task['success']} Your completed weeks stay preserved."
    from uuid import uuid4
    from app.services.learners.goals import goal_id
    from app.services.learners.models import CheckInEvent

    if existing.get("status") == data.status and existing.get("note") == data.note:
        return existing
    progress[str(week)] = {
        **data.model_dump(),
        "advice": advice,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    session.add(
        CheckInEvent(
            id=uuid4().hex,
            learner_id=row.id,
            payload=json.dumps(
                {"week": week, "goal_id": goal_id(row), **progress[str(week)]}
            ),
        )
    )
    row.progress = json.dumps(progress)
    session.commit()
    return progress[str(week)]


@router.put("/applications/{oid}")
def application(
    oid: str,
    data: ApplicationUpdate,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    from app.services.learners import tracking

    tracking.application(row, session, oid, data)
    return json.loads(row.applications)


@router.get("/applications")
def applications(row: Learner = Depends(learner), session: Session = Depends(db)):
    from app.services.learners import tracking

    return tracking.applications(row, session)


@router.get("/preparation/{oid}")
def preparation_get(
    oid: str, row: Learner = Depends(learner), session: Session = Depends(db)
):
    from app.services.learners import tracking

    return tracking.preparation(row, session, oid)


from app.contracts.schemas import PreparationUpdate


@router.put("/preparation/{oid}")
def preparation_put(
    oid: str,
    data: PreparationUpdate,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    from app.services.learners import tracking

    return tracking.preparation(row, session, oid, data)


@router.delete("/me")
def delete_me(
    response: Response, row: Learner = Depends(learner), session: Session = Depends(db)
):
    from sqlalchemy import delete
    from app.services.learners.models import (
        CheckInEvent,
        PlanRevision,
        CVReview,
        OpportunityProgress,
        WeekWork,
        AssessmentAttempt,
        GoalWorkspace,
        GoalReminder,
    )

    for model in [
        CheckInEvent,
        PlanRevision,
        CVReview,
        OpportunityProgress,
        WeekWork,
        AssessmentAttempt,
        GoalWorkspace,
        GoalReminder,
    ]:
        session.execute(delete(model).where(model.learner_id == row.id))
    session.delete(row)
    session.commit()
    response.delete_cookie("wetinnext_demo")
    return {"deleted": True}


@router.get("/check-ins", response_model=list[dict])
def history(row: Learner = Depends(learner), session: Session = Depends(db)):
    from sqlalchemy import select
    from app.services.learners.models import CheckInEvent

    events = [
        json.loads(e.payload)
        for e in session.scalars(
            select(CheckInEvent).where(CheckInEvent.learner_id == row.id)
        )
    ]
    from app.services.learners.goals import goal_id

    gid = goal_id(row)
    active_progress = json.loads(row.progress)
    events = [
        event
        for event in events
        if event.get("goal_id") == gid
        or (
            not event.get("goal_id")
            and str(event["week"]) in active_progress
            and event.get("updated_at")
            == active_progress[str(event["week"])].get("updated_at")
        )
    ]
    # Preserve available pre-refactor check-ins without inventing earlier events.
    for week, data in json.loads(row.progress).items():
        if not any(e["week"] == int(week) for e in events):
            events.append({**data, "week": int(week), "legacy": True})
    return sorted(events, key=lambda e: e.get("updated_at", ""), reverse=True)


@router.patch("/me/profile", response_model=dict)
def adjust_profile(
    data: ProfileAdjustment,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    from uuid import uuid4
    from app.services.learners.models import PlanRevision

    plan = json.loads(row.plan)
    if plan is None:
        raise HTTPException(409, "Create your first pathway before adjusting it.")
    profile, progress = json.loads(row.profile), json.loads(row.progress)
    session.add(
        PlanRevision(
            id=uuid4().hex,
            learner_id=row.id,
            payload=json.dumps(
                {
                    "profile": profile,
                    "plan": plan,
                    "revised_at": datetime.now(timezone.utc).isoformat(),
                }
            ),
        )
    )
    profile.update(data.model_dump())
    for week in plan["weeks"]:
        if progress.get(str(week["week"]), {}).get("status") != "done":
            week["minutes"] = (
                min(week["minutes"], data.hours * 60)
                if plan.get("research_id")
                else min(data.hours * 60, 150)
            )
            if data.low_data and week["resource_id"] == "hubspot-marketing":
                from app.core.clients import get_catalog_resources

                if any(
                    r["id"] == "openstax-marketing" for r in get_catalog_resources()
                ):
                    week["resource_id"] = "openstax-marketing"
            elif week["resource_id"] in ["gcf-sheets", "gcf-excel"]:
                week["resource_id"] = (
                    "gcf-sheets" if data.device == "phone" else "gcf-excel"
                )
            elif week["resource_id"] in ["mdn-web", "python-tutorial"]:
                from app.services.learners.pathways import template

                adapted = template(profile)["weeks"][week["week"] - 1]
                week.update(adapted)
    plan["revision"] = plan.get("revision", 1) + 1
    plan["notice"] = (
        plan.get("notice", "")
        + " Available time updated; research again if your device or learning needs change."
        if plan.get("research_id")
        else "Availability updated. Completed tasks are preserved; future work uses your current time and device."
    )
    row.profile, row.plan = json.dumps(profile), json.dumps(plan)
    session.commit()
    return {"saved": True, "revision": plan["revision"]}


def weekly_streak(events, now=None, zone="Africa/Kigali"):
    from datetime import timedelta
    from zoneinfo import ZoneInfo

    today = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo(zone)).date()
    current = today - timedelta(days=today.weekday())
    active = set()
    for event in events:
        try:
            date = (
                datetime.fromisoformat(event["updated_at"])
                .astimezone(ZoneInfo(zone))
                .date()
            )
            active.add(date - timedelta(days=date.weekday()))
        except (KeyError, ValueError, TypeError):
            continue
    # Allow a new week to begin without wiping last week's streak immediately.
    cursor = current if current in active else current - timedelta(days=7)
    count = 0
    while cursor in active:
        count += 1
        cursor -= timedelta(days=7)
    return count


@router.put("/me/goal")
def replace_goal(
    profile: Profile, row: Learner = Depends(learner), session: Session = Depends(db)
):
    from app.services.learners.goals import save_current, goal_id, activate
    from app.services.learners.models import GoalWorkspace

    save_current(row, session)
    existing = session.get(GoalWorkspace, goal_id(row, profile.goal))
    if existing:
        result = activate(existing.id, row, session)
        return {**result, "restored": True}
    row.plan = "null"
    row.progress = "{}"
    row.applications = "{}"
    result = update_profile(profile, row, session)
    save_current(row, session)
    session.commit()
    return result
