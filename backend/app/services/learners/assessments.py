import json, secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.clients import service_call
from app.contracts.schemas import QuizAnswer, QuizSettings
from .dependencies import learner
from .database import db
from .models import Learner, AssessmentAttempt, CVReview, WeekWork

router = APIRouter()


def context(row):
    return json.loads(row.profile), json.loads(row.plan) or {}


def latest(row, session):
    profile, plan = context(row)
    return session.scalars(
        select(AssessmentAttempt)
        .where(
            AssessmentAttempt.learner_id == row.id,
            AssessmentAttempt.goal == profile.get("goal", ""),
            AssessmentAttempt.sprint_id == plan.get("id", ""),
        )
        .order_by(AssessmentAttempt.created_at.desc())
        .limit(1)
    ).first()


def public(record):
    data = json.loads(record.payload)
    result = {
        "id": record.id,
        "title": data["quiz"]["title"],
        "questions": [
            {"prompt": q["prompt"], "options": q["options"]}
            for q in data["quiz"]["questions"]
        ],
        "completed": bool(data.get("result")),
        "question_count": len(data["quiz"]["questions"]),
        "difficulty": data.get("settings", {}).get("difficulty", "beginner"),
    }
    result["time_limit_minutes"] = data.get("settings", {}).get("time_limit_minutes", 0)
    result["expires_at"] = data.get("expires_at")
    if data.get("result"):
        result["result"] = data["result"]
    return result


@router.get("/me/assessment")
def get(row: Learner = Depends(learner), session: Session = Depends(db)):
    record = latest(row, session)
    return public(record) if record else None


@router.post("/me/assessment")
async def create(
    request: Request,
    body: QuizSettings = QuizSettings(),
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    profile, plan = context(row)
    resources = plan.get("resources", [])
    if not resources:
        raise HTTPException(
            409,
            "Use a researched plan first so your practice quiz follows its learning subjects.",
        )
    previous = latest(row, session)
    if previous:
        old = json.loads(previous.payload)
        still_running = not old.get("expires_at") or datetime.now(
            timezone.utc
        ) < datetime.fromisoformat(old["expires_at"])
        if (
            not old.get("result")
            and still_running
            and QuizSettings(**old.get("settings", {})).model_dump()
            == body.model_dump()
        ):
            return public(previous)
    result = await service_call(
        "matching",
        "/quiz/build",
        request,
        "POST",
        {
            **body.model_dump(),
            "goal": profile["goal"],
            "resources": [
                {k: r.get(k) for k in ["id", "title", "url", "skills", "review"]}
                for r in resources
            ],
        },
    )
    expires = (
        (
            datetime.now(timezone.utc) + timedelta(minutes=body.time_limit_minutes)
        ).isoformat()
        if body.time_limit_minutes
        else None
    )
    record = AssessmentAttempt(
        id=secrets.token_hex(16),
        learner_id=row.id,
        goal=profile["goal"],
        sprint_id=plan["id"],
        created_at=datetime.now(timezone.utc).isoformat(),
        payload=json.dumps(
            {
                "quiz": result.json(),
                "resources": resources,
                "settings": body.model_dump(),
                "expires_at": expires,
            }
        ),
    )
    session.add(record)
    session.commit()
    return public(record)


@router.post("/me/assessment/{attempt_id}/submit")
def submit(
    attempt_id: str,
    body: QuizAnswer,
    row: Learner = Depends(learner),
    session: Session = Depends(db),
):
    record = session.get(AssessmentAttempt, attempt_id)
    profile, plan = context(row)
    if not record or record.learner_id != row.id:
        raise HTTPException(404, "Practice attempt not found.")
    if record.goal != profile.get("goal") or record.sprint_id != plan.get("id"):
        raise HTTPException(409, "This practice belongs to an earlier plan.")
    data = json.loads(record.payload)
    if len(body.answers) != len(data["quiz"]["questions"]):
        raise HTTPException(422, "Answer every question in this practice set.")
    expired = bool(
        data.get("expires_at")
        and datetime.now(timezone.utc) >= datetime.fromisoformat(data["expires_at"])
    )
    if any(answer is None for answer in body.answers) and not expired:
        raise HTTPException(
            422,
            "Answer every question before submitting, or wait for the timer to finish.",
        )
    if not data.get("result"):
        sources = {r["id"]: r for r in data["resources"]}
        feedback = []
        for answer, q in zip(body.answers, data["quiz"]["questions"]):
            source = sources[q["source_id"]]
            if q.get("source_url"):
                source = {
                    **source,
                    "url": q["source_url"],
                    "title": q.get("source_title") or source["title"],
                    "specific_reference": True,
                }
            feedback.append(
                {
                    "correct": answer == q["correct"],
                    "selected_answer": q["options"][answer]
                    if answer is not None
                    else None,
                    "selected_index": answer,
                    "correct_index": q["correct"],
                    "answer": q["options"][q["correct"]],
                    "explanation": q["explanation"],
                    "source": source,
                }
            )
        data["result"] = {
            "correct": sum(x["correct"] for x in feedback),
            "total": len(feedback),
            "unanswered": sum(a is None for a in body.answers),
            "time_expired": expired,
            "feedback": feedback,
            "notice": "AI-generated introductory practice, not a validated exam, qualification or hiring-readiness score.",
        }
        record.payload = json.dumps(data)
        session.commit()
    return public(record)


@router.get("/me/readiness")
def readiness(row: Learner = Depends(learner), session: Session = Depends(db)):
    profile, plan = context(row)
    attempts = session.scalars(
        select(AssessmentAttempt)
        .where(
            AssessmentAttempt.learner_id == row.id,
            AssessmentAttempt.goal == profile.get("goal", ""),
            AssessmentAttempt.sprint_id == plan.get("id", ""),
        )
        .order_by(AssessmentAttempt.created_at.desc())
    ).all()
    result = next(
        (
            data["result"]
            for record in attempts
            if (data := json.loads(record.payload)).get("result")
        ),
        None,
    )
    cv = session.scalars(select(CVReview).where(CVReview.learner_id == row.id)).all()
    evidence = session.scalars(
        select(WeekWork).where(
            WeekWork.learner_id == row.id, WeekWork.sprint_id == plan.get("id", "")
        )
    ).all()
    return {
        "goal": profile.get("goal", ""),
        "practice": {"correct": result["correct"], "total": result["total"]}
        if result
        else None,
        "cv_reviewed": any(
            json.loads(r.payload).get("goal") == profile.get("goal") for r in cv
        ),
        "evidence_count": sum(
            bool(
                json.loads(r.payload).get("reflection")
                or json.loads(r.payload).get("evidence_url")
            )
            for r in evidence
        ),
        "qualification_status": "Not verified",
        "eligibility_status": "Confirm against each opportunity",
        "notice": "Practice scores, CV mentions and saved work are signals. An employer, admissions team or regulator must assess the required skills, qualifications and eligibility.",
    }
