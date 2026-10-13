"""Roles come only from verified server-issued sessions or admin-managed JWT claims."""

import jwt
from fastapi import HTTPException, Request
from app.core.config import settings
from app.core import security


def principal(request: Request):
    from app.core.telegram_identity import verify

    telegram = verify(request.headers.get("authorization", ""))
    if telegram:
        return {"id": telegram, "role": "learner"}
    if request.headers.get("authorization", "").startswith("Bearer "):
        claims = security.verified_claims(request)
        metadata = claims.get("app_metadata", {})
        role = metadata.get("role") if isinstance(metadata, dict) else None
        return {"id": claims["sub"], "role": "admin" if role == "admin" else "learner"}
    if settings.demo_mode:
        token = request.cookies.get("wetinnext_role_session")
        if token:
            if not settings.admin_key:
                raise HTTPException(401, "Local account sign-in is not configured.")
            try:
                claims = jwt.decode(
                    token,
                    settings.admin_key,
                    algorithms=["HS256"],
                    audience="wetinnext-local",
                    issuer="wetinnext-local",
                    options={"require": ["exp", "sub", "role"]},
                )
                if claims["role"] in ["admin", "admin_demo", "learner"]:
                    return {"id": claims["sub"], "role": claims["role"]}
            except jwt.PyJWTError:
                raise HTTPException(
                    401, "Your session has expired. Please sign in again."
                )
        return {"id": None, "role": "learner"}
    claims = security.verified_claims(request)
    metadata = claims.get("app_metadata", {})
    role = metadata.get("role") if isinstance(metadata, dict) else None
    return {"id": claims["sub"], "role": "admin" if role == "admin" else "learner"}
