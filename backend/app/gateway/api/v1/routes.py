from typing import Literal
from fastapi import APIRouter, Request, Response, Query, Depends
from fastapi.security import HTTPBearer, APIKeyCookie
from app.contracts.schemas import (
    Profile,
    CheckIn,
    ApplicationUpdate,
    ProfileAdjustment,
    Resource,
    Opportunity,
    MatchingAssessment,
    LearnerState,
)
from app.core.clients import service_call
from app.core.config import settings

router = APIRouter(
    dependencies=[
        Depends(HTTPBearer(auto_error=False)),
        Depends(APIKeyCookie(name="wetinnext_demo", auto_error=False)),
    ]
)


async def forward(service, path, request, method="GET", payload=None):
    result = await service_call(service, path, request, method, payload)
    response = Response(
        result.content, status_code=result.status_code, media_type="application/json"
    )
    response.headers["Cache-Control"] = "no-store"
    for cookie in result.headers.get_list("set-cookie"):
        response.headers.append("set-cookie", cookie)
    return response


@router.get("/health", tags=["Operations"])
def health():
    return {
        "status": "ok",
        "service": "gateway",
        "demo_mode": settings.demo_mode,
        "telegram_bot_url": settings.telegram_bot_url or None,
        "ai_configured": bool(settings.openai_api_key and settings.openai_model),
        "telegram_bot_configured": bool(
            settings.telegram_bot_token and len(settings.telegram_service_secret) >= 32
        ),
    }


@router.post("/demo/session", tags=["Identity"])
async def demo_session(request: Request):
    return await forward("learner", "/demo/session", request, "POST")


@router.get("/me", tags=["Learners"], response_model=LearnerState)
async def me(request: Request):
    return await forward("learner", "/me", request)


@router.put("/me/profile", tags=["Learners"], response_model=dict)
async def profile(data: Profile, request: Request):
    return await forward("learner", "/me/profile", request, "PUT", data.model_dump())


@router.patch("/me/profile", tags=["Pathways"], response_model=dict)
async def adjust(data: ProfileAdjustment, request: Request):
    """Adjust hours/device and future work while retaining completed tasks."""
    return await forward("learner", "/me/profile", request, "PATCH", data.model_dump())


@router.post("/weeks/{week}/check-in", tags=["Check-ins"], response_model=dict)
async def check_in(week: int, data: CheckIn, request: Request):
    return await forward(
        "learner", f"/weeks/{week}/check-in", request, "POST", data.model_dump()
    )


@router.get("/check-ins", tags=["Check-ins"], response_model=list[dict])
async def history(request: Request):
    return await forward("learner", "/check-ins", request)


@router.get("/resources", tags=["Catalogue"], response_model=list[Resource])
async def resources(request: Request):
    return await forward("catalog", "/resources", request)


@router.get("/opportunities", tags=["Catalogue"], response_model=list[Opportunity])
async def opportunities(
    request: Request,
    country: str | None = None,
    q: str = Query(default="", max_length=100),
):
    from urllib.parse import urlencode

    return await forward(
        "catalog",
        "/opportunities?"
        + urlencode({k: v for k, v in {"country": country, "q": q}.items() if v}),
        request,
    )


@router.get("/opportunities/{oid}", tags=["Catalogue"], response_model=Opportunity)
async def opportunity(oid: str, request: Request):
    return await forward("catalog", f"/opportunities/{oid}", request)


@router.get(
    "/opportunities/{oid}/assessment",
    tags=["Matching"],
    response_model=MatchingAssessment,
)
async def assessment(oid: str, request: Request):
    return await forward("matching", f"/opportunities/{oid}/assessment", request)


@router.put("/applications/{oid}", tags=["Applications"], response_model=dict)
async def applications(oid: str, data: ApplicationUpdate, request: Request):
    return await forward(
        "learner", f"/applications/{oid}", request, "PUT", data.model_dump()
    )


@router.delete("/me", tags=["Learners"], response_model=dict)
async def delete(request: Request):
    try:
        await service_call("matching", "/research", request, "DELETE")
    except Exception:
        pass  # Ephemeral research expires; never block core account erasure.
    return await forward("learner", "/me", request, "DELETE")


# Admin and CV requests retain the service ownership boundary.
from app.core.admin import require_admin
from app.contracts.schemas import CVUpload as Upload
from app.contracts.schemas import ContentEdit
from typing import Literal


@router.get(
    "/admin/learners", tags=["Administration"], dependencies=[Depends(require_admin)]
)
async def admin_learners(
    request: Request,
    page: int | None = Query(None, ge=1, le=100000),
    page_size: int = Query(10, ge=1, le=50),
    q: str = Query("", max_length=100),
):
    return await forward(
        "learner", "/admin/learners?" + str(request.query_params), request
    )


@router.get(
    "/admin/audit", tags=["Administration"], dependencies=[Depends(require_admin)]
)
async def admin_audit(
    request: Request,
    page: int | None = Query(None, ge=1, le=100000),
    page_size: int = Query(10, ge=1, le=50),
    q: str = Query("", max_length=100),
):
    return await forward(
        "catalog", "/admin/audit?" + str(request.query_params), request
    )


@router.get(
    "/admin/content/{kind}",
    tags=["Administration"],
    dependencies=[Depends(require_admin)],
)
async def admin_content(kind: Literal["resources", "opportunities"], request: Request):
    return await forward("catalog", f"/admin/content/{kind}", request)


@router.put(
    "/admin/content/{kind}/{item_id}",
    tags=["Administration"],
    dependencies=[Depends(require_admin)],
)
async def admin_save(
    kind: Literal["resources", "opportunities"],
    item_id: str,
    body: ContentEdit,
    request: Request,
):
    return await forward(
        "catalog", f"/admin/content/{kind}/{item_id}", request, "PUT", body.model_dump()
    )


@router.get("/me/cv-reviews", tags=["CV reviews"])
async def cv_history(
    request: Request,
    page: int | None = Query(None, ge=1, le=100000),
    page_size: int = Query(6, ge=1, le=50),
    q: str = Query("", max_length=100),
):
    return await forward(
        "learner", "/me/cv-reviews?" + str(request.query_params), request
    )


@router.post("/me/cv-reviews", tags=["CV reviews"])
async def cv_upload(body: Upload, request: Request):
    return await forward(
        "learner", "/me/cv-reviews", request, "POST", body.model_dump()
    )


@router.delete("/me/cv-reviews/{review_id}", tags=["CV reviews"])
async def cv_delete(review_id: str, request: Request):
    return await forward("learner", f"/me/cv-reviews/{review_id}", request, "DELETE")


@router.get(
    "/admin/sources", tags=["Source ingestion"], dependencies=[Depends(require_admin)]
)
async def sources(request: Request):
    return await forward("catalog", "/admin/sources", request)


@router.post(
    "/admin/sources/{provider}/sync",
    tags=["Source ingestion"],
    dependencies=[Depends(require_admin)],
)
async def source_sync(
    provider: Literal["jobicy", "freecodecamp", "remotive", "reliefweb", "hec"],
    request: Request,
):
    return await forward("catalog", f"/admin/sources/{provider}/sync", request, "POST")


@router.get("/recommendations", tags=["Matching"])
async def recommendations(
    request: Request, country: Literal["Nigeria", "Rwanda", "Global"] | None = None
):
    return await forward(
        "matching",
        "/recommendations" + (f"?country={country}" if country else ""),
        request,
    )


@router.get("/admin/source-settings", dependencies=[Depends(require_admin)])
async def automatic_settings(request: Request):
    return await forward("catalog", "/admin/source-settings", request)


@router.put("/admin/source-settings", dependencies=[Depends(require_admin)])
async def automatic_update(body: dict, request: Request):
    require_admin(request)
    return await forward("catalog", "/admin/source-settings", request, "PUT", body)


from app.contracts.schemas import PreparationUpdate


@router.get("/applications", tags=["Applications"])
async def application_list(request: Request):
    return await forward("learner", "/applications", request)


@router.get("/preparation/{oid}", tags=["Applications"])
async def preparation_get(oid: str, request: Request):
    return await forward("learner", f"/preparation/{oid}", request)


@router.put("/preparation/{oid}", tags=["Applications"])
async def preparation_put(oid: str, data: PreparationUpdate, request: Request):
    return await forward(
        "learner", f"/preparation/{oid}", request, "PUT", data.model_dump()
    )


@router.get("/regional-sources", tags=["Catalogue"])
async def regional_sources(request: Request, country: str | None = None):
    from urllib.parse import urlencode

    return await forward(
        "catalog",
        "/regional-sources"
        + ("?" + urlencode({"country": country}) if country else ""),
        request,
    )


@router.get("/search", tags=["Search"])
async def search(
    request: Request,
    kind: Literal["resources", "opportunities"] = "opportunities",
    q: str = Query("", max_length=100),
    country: Literal["Nigeria", "Rwanda", "Global"] | None = None,
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(6, ge=1, le=50),
    live_only: bool = False,
    low_data_only: bool = False,
):
    return await forward("catalog", "/search?" + str(request.query_params), request)


@router.get("/admin/search", tags=["Search"], dependencies=[Depends(require_admin)])
async def admin_search(
    request: Request,
    kind: Literal["resources", "opportunities"] = "opportunities",
    q: str = Query("", max_length=100),
    country: Literal["Nigeria", "Rwanda", "Global"] | None = None,
    status: Literal["all", "published", "draft", "archived"] = "all",
    page: int = Query(1, ge=1, le=100000),
    page_size: int = Query(10, ge=1, le=50),
):
    return await forward(
        "catalog", "/admin/search?" + str(request.query_params), request
    )


@router.get("/weeks/{week}/work", tags=["Weekly work"])
async def week_work(week: int, request: Request):
    return await forward("learner", f"/weeks/{week}/work", request)


from app.contracts.schemas import WorkUpdate


@router.put("/weeks/{week}/work", tags=["Weekly work"])
async def save_week_work(week: int, body: WorkUpdate, request: Request):
    return await forward(
        "learner", f"/weeks/{week}/work", request, "PUT", body.model_dump()
    )


@router.get("/me/portfolio", tags=["Weekly work"])
async def portfolio(request: Request):
    return await forward("learner", "/me/portfolio", request)


from app.contracts.schemas import ExternalJob


@router.post("/me/external-job-review", tags=["Matching"])
async def external_job_review(data: ExternalJob, request: Request):
    return await forward(
        "learner", "/me/external-job-review", request, "POST", data.model_dump()
    )


from app.contracts.schemas import ResearchRequest, ResearchAdoption


@router.post("/research", tags=["Goal research"])
async def research_start(data: ResearchRequest, request: Request):
    return await forward("matching", "/research", request, "POST", data.model_dump())


@router.get("/research/{research_id}", tags=["Goal research"])
async def research_status(research_id: str, request: Request):
    return await forward("matching", f"/research/{research_id}", request)


@router.post("/me/research-plan", tags=["Pathways"])
async def research_adopt(data: ResearchAdoption, request: Request):
    return await forward(
        "learner", "/me/research-plan", request, "POST", data.model_dump()
    )


@router.get("/me/research", tags=["Goal research"])
async def latest_research(
    request: Request, market: Literal["Nigeria", "Rwanda", "Global"] = "Nigeria"
):
    return await forward("matching", f"/me/research?market={market}", request)


@router.put("/me/goal", tags=["Learners"])
async def change_goal(data: Profile, request: Request):
    return await forward("learner", "/me/goal", request, "PUT", data.model_dump())


from app.contracts.schemas import QuizAnswer, QuizSettings


@router.get("/me/readiness", tags=["Assessments"])
async def readiness(request: Request):
    return await forward("learner", "/me/readiness", request)


@router.get("/me/assessment", tags=["Assessments"])
async def assessment_get(request: Request):
    return await forward("learner", "/me/assessment", request)


@router.post("/me/assessment", tags=["Assessments"])
async def assessment_create(request: Request, body: QuizSettings = QuizSettings()):
    return await forward(
        "learner", "/me/assessment", request, "POST", body.model_dump()
    )


@router.post("/me/assessment/{attempt_id}/submit", tags=["Assessments"])
async def assessment_submit(attempt_id: str, data: QuizAnswer, request: Request):
    return await forward(
        "learner",
        f"/me/assessment/{attempt_id}/submit",
        request,
        "POST",
        data.model_dump(),
    )


@router.get("/me/goals", tags=["Goals"])
async def goals(request: Request):
    return await forward("learner", "/me/goals", request)


@router.post("/me/goals/{goal_id}/activate", tags=["Goals"])
async def goal_activate(goal_id: str, request: Request):
    return await forward("learner", f"/me/goals/{goal_id}/activate", request, "POST")


@router.get("/me/skills", tags=["Progress"])
async def goal_skills(request: Request):
    return await forward("learner", "/me/skills", request)


@router.get("/me/preparation", tags=["Progress"])
async def preparation(request: Request):
    return await forward("learner", "/me/preparation", request)


@router.get("/me/reminders", tags=["Progress"])
async def reminder_read(request: Request):
    return await forward("learner", "/me/reminders", request)


from app.contracts.schemas import ReminderSettings


@router.put("/me/reminders", tags=["Progress"])
async def reminder_save(body: ReminderSettings, request: Request):
    return await forward("learner", "/me/reminders", request, "PUT", body.model_dump())


@router.post("/me/reminders/acknowledge", tags=["Progress"])
async def reminder_ack(request: Request):
    return await forward("learner", "/me/reminders/acknowledge", request, "POST")
