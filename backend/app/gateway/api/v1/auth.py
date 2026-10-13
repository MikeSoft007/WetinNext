import secrets
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from app.core.config import settings
from app.core.roles import principal

router = APIRouter(prefix="/auth", tags=["Identity"])


class Login(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=500)


@router.get("/session")
def session(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {
        **principal(request),
        "mode": "demo" if settings.demo_mode else "authenticated",
    }


@router.post("/sign-in")
def sign_in(data: Login, request: Request, response: Response):
    if not settings.demo_mode:
        raise HTTPException(404, "Use the configured account provider.")
    origin = request.headers.get("origin")
    if origin and origin not in ["http://127.0.0.1:5173", "http://localhost:5173"]:
        raise HTTPException(403, "Local sign-in only.")
    from app.core.demo_accounts import ACCOUNTS

    account = next(
        (
            a
            for a in ACCOUNTS
            if secrets.compare_digest(
                data.email.strip().lower().encode(), a["email"].encode()
            )
        ),
        None,
    )
    seeded = bool(
        account
        and settings.demo_seed_password
        and secrets.compare_digest(
            data.password.encode(), settings.demo_seed_password.encode()
        )
    )
    legacy_admin = (
        secrets.compare_digest(
            data.email.lower().encode(), settings.demo_admin_email.lower().encode()
        )
        and bool(settings.admin_key)
        and secrets.compare_digest(data.password.encode(), settings.admin_key.encode())
    )
    if not settings.admin_key or not (seeded or legacy_admin):
        raise HTTPException(401, "Email or password is incorrect.")
    account = account if seeded else {"id": "local-administrator", "role": "admin"}
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": account["id"],
            "role": account["role"],
            "iss": "wetinnext-local",
            "aud": "wetinnext-local",
            "iat": now,
            "exp": now + timedelta(hours=8),
        },
        settings.admin_key,
        algorithm="HS256",
    )
    response.set_cookie(
        "wetinnext_role_session",
        token,
        httponly=True,
        samesite="strict",
        max_age=8 * 3600,
    )
    response.headers["Cache-Control"] = "no-store"
    return {"role": account["role"]}


@router.post("/sign-out")
def sign_out(response: Response):
    response.delete_cookie("wetinnext_role_session")
    return {"signed_out": True}


@router.post("/admin-demo")
def admin_demo(request: Request, response: Response):
    """Local preview role permits inspection only, never administrative writes."""
    if not settings.demo_mode or not settings.admin_key:
        raise HTTPException(404, "Admin demo is not enabled.")
    origin = request.headers.get("origin")
    if origin and origin not in ["http://127.0.0.1:5173", "http://localhost:5173"]:
        raise HTTPException(403, "Local demo only.")
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": "admin-preview",
            "role": "admin_demo",
            "iss": "wetinnext-local",
            "aud": "wetinnext-local",
            "iat": now,
            "exp": now + timedelta(hours=1),
        },
        settings.admin_key,
        algorithm="HS256",
    )
    response.set_cookie(
        "wetinnext_role_session", token, httponly=True, samesite="strict", max_age=3600
    )
    response.headers["Cache-Control"] = "no-store"
    return {"role": "admin_demo", "read_only": True}


@router.get("/demo-accounts")
def demo_accounts():
    if not settings.demo_mode:
        raise HTTPException(404)
    from app.core.demo_accounts import ACCOUNTS

    return {
        "accounts": ACCOUNTS,
        "password": settings.demo_seed_password,
        "notice": "Shared local demo accounts. Changes persist for each account.",
    }
