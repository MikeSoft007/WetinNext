"""Review user-supplied job text; never fetch the URL or claim availability."""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.services.learners.dependencies import learner
from app.services.learners.database import db
from app.services.learners.models import Learner, CVReview
from app.core.skills import skills_in
from app.core.clients import get_catalog_resources
from app.core.learning import prefer_low_data

router = APIRouter()

from app.contracts.schemas import ExternalJob


@router.post("/me/external-job-review")
def review(
    body: ExternalJob, row: Learner = Depends(learner), session: Session = Depends(db)
):
    profile = json.loads(row.profile)
    latest = session.scalars(
        select(CVReview)
        .where(CVReview.learner_id == row.id)
        .order_by(CVReview.created_at.desc())
        .limit(1)
    ).first()
    mentioned = set(skills_in(profile.get("background", "")))
    if latest:
        mentioned.update(json.loads(latest.payload).get("skills", []))
    required = set(skills_in(body.description))
    gaps = sorted(required - mentioned)
    try:
        resources = prefer_low_data(get_catalog_resources(), profile)
    except HTTPException:
        resources = []
    resources = sorted(
        [r for r in resources if set(r.get("skills", [])) & set(gaps)],
        key=lambda r: len(set(r.get("skills", [])) & set(gaps)),
        reverse=True,
    )[:2]
    return {
        "url": body.url,
        "supported": sorted(required & mentioned),
        "gaps": gaps,
        "resources": resources,
        "actions": [
            f"Add a truthful project example for {skill}, or practise it before claiming experience."
            for skill in gaps[:3]
        ]
        or [
            "Compare eligibility, responsibilities and experience directly with the employer."
        ],
        "notice": "Based on pasted text and declared skills. Availability, eligibility and proficiency are unverified. This review is not saved.",
    }
