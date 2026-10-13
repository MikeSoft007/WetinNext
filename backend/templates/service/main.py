"""Copy this folder to app/services/<name>; replace name and register in gateway."""

from app.core.factory import create_app
from .api.v1.routes import router

app = create_app("New domain service")
app.include_router(router, prefix="/api/v1")
