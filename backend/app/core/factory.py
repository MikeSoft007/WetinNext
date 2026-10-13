from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException


def create_app(name: str, lifespan=None):
    app = FastAPI(
        title=f"WetinNext {name}",
        version="1.0.0",
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        incoming = request.headers.get("x-request-id", "")
        request.state.request_id = (
            incoming
            if 0 < len(incoming) <= 64
            and all(c.isalnum() or c in "-_" for c in incoming)
            else uuid4().hex
        )
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc):
        return JSONResponse(
            {"detail": exc.detail, "request_id": request.state.request_id},
            status_code=exc.status_code,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc):
        # Do not reflect learner input into diagnostic errors.
        return JSONResponse(
            {
                "detail": [
                    {"location": list(e["loc"]), "message": e["msg"]}
                    for e in exc.errors()
                ],
                "request_id": request.state.request_id,
            },
            status_code=422,
        )

    @app.get("/health", tags=["Operations"])
    def health():
        return {"status": "ok", "service": name, "version": "v1"}

    return app
