from app.core.factory import create_app
from .api.v1.routes import router

from .automatic import lifespan, router as automatic_router

app = create_app("Catalogue service", lifespan=lifespan)
app.include_router(automatic_router, prefix="/api/v1")
app.include_router(router, prefix="/api/v1")

from .api.v1.admin import router as admin_router

app.include_router(admin_router, prefix="/api/v1")

from .ingestion import router as ingestion_router

app.include_router(ingestion_router, prefix="/api/v1")

from .search import router as search_router

app.include_router(search_router, prefix="/api/v1")
