"""Public gateway entry point. Domain services run in separate processes."""

from app.core.factory import create_app
from app.gateway.api.v1.routes import router

app = create_app("API Gateway")
app.include_router(router, prefix="/api/v1")
# Temporary compatibility for the first UI and existing REST clients.
app.include_router(router, prefix="/api", deprecated=True, include_in_schema=False)

from app.gateway.api.v1.auth import router as auth_router

app.include_router(auth_router, prefix="/api/v1")
