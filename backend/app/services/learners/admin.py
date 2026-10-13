import json
from fastapi import APIRouter, Depends, Request, Query
from app.core.search import rank, paginate
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.core.admin import require_admin
from .database import db
from .models import Learner, CheckInEvent, CVReview

router = APIRouter(
    prefix="/admin", tags=["Administration"], dependencies=[Depends(require_admin)]
)


@router.get("/learners")
def learners(
    request: Request,
    session: Session = Depends(db),
    page: int | None = Query(None, ge=1, le=100000),
    page_size: int = Query(10, ge=1, le=50),
    q: str = Query("", max_length=100),
):
    from app.core.roles import principal
    from app.core.config import settings

    if settings.demo_mode and principal(request)["role"] == "admin_demo":
        result = {
            "sample": True,
            "total": 3,
            "check_ins": 7,
            "cv_reviews": 2,
            "learners": [
                {
                    "id": "demo-ada",
                    "name": "Ada (sample)",
                    "country": "Nigeria",
                    "learner_type": "student",
                    "has_pathway": True,
                    "completed": 2,
                },
                {
                    "id": "demo-keza",
                    "name": "Keza (sample)",
                    "country": "Rwanda",
                    "learner_type": "self-taught",
                    "has_pathway": True,
                    "completed": 1,
                },
                {
                    "id": "demo-tobi",
                    "name": "Tobi (sample)",
                    "country": "Nigeria",
                    "learner_type": "both",
                    "has_pathway": False,
                    "completed": 0,
                },
            ],
        }

        return (
            paginate(
                rank(
                    result["learners"], q, {"name": 3, "country": 1, "learner_type": 1}
                ),
                page,
                page_size,
            )
            if page
            else result
        )

    records = session.scalars(select(Learner).order_by(Learner.id)).all()
    result = {
        "total": session.scalar(select(func.count()).select_from(Learner)),
        "check_ins": session.scalar(select(func.count()).select_from(CheckInEvent)),
        "cv_reviews": session.scalar(select(func.count()).select_from(CVReview)),
        "learners": [
            {
                "id": r.id,
                "name": json.loads(r.profile).get("name", "New learner"),
                "country": json.loads(r.profile).get("country", "—"),
                "learner_type": json.loads(r.profile).get("learner_type", "—"),
                "has_pathway": json.loads(r.plan) is not None,
                "completed": sum(
                    p.get("status") == "done" for p in json.loads(r.progress).values()
                ),
            }
            for r in records
        ],
    }

    return (
        paginate(
            rank(result["learners"], q, {"name": 3, "country": 1, "learner_type": 1}),
            page,
            page_size,
        )
        if page
        else result
    )
