from contextlib import asynccontextmanager
from app.core.factory import create_app
from .database import engine
from .models import Base
from .api.v1.routes import router


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    yield


app = create_app("Learner and pathway service", lifespan=lifespan)
app.include_router(router, prefix="/api/v1", tags=["Learners and pathways"])

from .cv import router as cv_router
from .admin import router as admin_router

app.include_router(cv_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")

from .work import router as work_router

app.include_router(work_router, prefix="/api/v1")

from .external_jobs import router as external_jobs_router

app.include_router(external_jobs_router, prefix="/api/v1")

from .research_plan import router as research_plan_router

app.include_router(research_plan_router, prefix="/api/v1")

from .assessments import router as assessment_router

app.include_router(assessment_router, prefix="/api/v1")

from .goals import router as goals_router

app.include_router(goals_router, prefix="/api/v1")

from .skills import router as skills_router

app.include_router(skills_router, prefix="/api/v1")

from .preparation import router as preparation_router

app.include_router(preparation_router, prefix="/api/v1")

from .learning_picks import router as learning_picks_router

app.include_router(learning_picks_router, prefix="/api/v1")

from .branches import router as branches_router

app.include_router(branches_router, prefix="/api/v1")

from .journey import router as journey_router

app.include_router(journey_router, prefix="/api/v1")
