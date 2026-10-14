from typing import Literal
from fastapi import APIRouter, HTTPException, Request, Response
from app.contracts.schemas import BranchReviewRequest, MatchingAssessment
from app.core.clients import service_call

router = APIRouter(tags=["Matching"])


@router.get("/opportunities/{oid}/assessment", response_model=MatchingAssessment)
async def assessment(oid: str, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    """Compose catalogue facts and authenticated learner evidence through REST."""
    learner = (await service_call("learner", "/me", request)).json()
    opportunity = (
        await service_call("catalog", f"/opportunities/{oid}", request)
    ).json()
    from app.services.matching.intelligence import opportunity_fit

    reviews = (await service_call("learner", "/me/cv-reviews", request)).json()
    resources = (await service_call("catalog", "/resources", request)).json()
    resources = (learner.get("plan") or {}).get("resources", []) + resources
    return await opportunity_fit(opportunity, learner, reviews, resources)


@router.get("/recommendations")
async def recommendations(
    request: Request,
    response: Response,
    country: Literal["Nigeria", "Rwanda", "Global"] | None = None,
):
    response.headers["Cache-Control"] = "no-store"
    from app.services.matching.intelligence import discover

    learner = (await service_call("learner", "/me", request)).json()
    reviews = (await service_call("learner", "/me/cv-reviews", request)).json()
    resources = (await service_call("catalog", "/resources", request)).json()
    resources = (learner.get("plan") or {}).get("resources", []) + resources
    opportunities = (await service_call("catalog", "/opportunities", request)).json()
    return await discover(learner, reviews, resources, opportunities, market=country)


@router.post("/pathway/branch-review")
async def branch_review(
    data: BranchReviewRequest, request: Request, response: Response
):
    from app.services.matching.intelligence import (
        GuidanceCooldown,
        guidance_failure_reason,
        review_branch,
    )

    response.headers["Cache-Control"] = "no-store"
    learner = (await service_call("learner", "/me", request)).json()
    work = (
        await service_call(
            "learner", f"/weeks/{data.week}/work", request
        )
    ).json()
    resources = (await service_call("catalog", "/resources", request)).json()
    try:
        return await review_branch(learner, work, resources)
    except GuidanceCooldown as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(503, guidance_failure_reason(exc)) from exc
