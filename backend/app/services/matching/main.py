from app.core.factory import create_app
from .api.v1.routes import router

app = create_app("Matching service")
app.include_router(router, prefix="/api/v1")

from .research import router as research_router

app.include_router(research_router, prefix="/api/v1")


from .quizzes import router as quiz_router

app.include_router(quiz_router, prefix="/api/v1")
