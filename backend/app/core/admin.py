import secrets
from fastapi import Request, HTTPException
from app.core.config import settings


def require_admin(request: Request):
    # Retained for trusted REST automation; never sent by the browser UI.
    key = request.headers.get("x-admin-key", "")
    if (
        key
        and settings.admin_key
        and secrets.compare_digest(key.encode(), settings.admin_key.encode())
    ):
        return
    from app.core.roles import principal

    role = principal(request)["role"]
    if role == "admin_demo":
        if request.method not in ["GET", "HEAD"]:
            raise HTTPException(
                403,
                "Admin demo is read-only. Sign in as an administrator to save changes.",
            )
        return
    if role != "admin":
        raise HTTPException(403, "Administrator role required.")
