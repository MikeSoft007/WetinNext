import hashlib
import jwt
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer
from app.core.config import settings

jwks = (
    jwt.PyJWKClient(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    )
    if settings.supabase_url
    else None
)


def identity(request: Request) -> str:
    from app.core.telegram_identity import verify

    telegram = verify(request.headers.get("authorization", ""))
    if telegram:
        return telegram
    if request.headers.get("authorization", "").startswith("Bearer "):
        claims = verified_claims(request)
        request.state.auth_claims = claims
        return claims["sub"]
    if settings.demo_mode:
        if request.cookies.get("wetinnext_role_session"):
            from app.core.roles import principal

            account = principal(request)
            if account["role"] == "learner" and account["id"]:
                return account["id"]
            raise HTTPException(403, "Use a learner account to access learning data.")
        token = request.cookies.get("wetinnext_demo", "")
        if len(token) != 64 or any(c not in "0123456789abcdef" for c in token):
            raise HTTPException(401, "Start a local demo session first.")
        return hashlib.sha256(token.encode()).hexdigest()
    return verified_claims(request)["sub"]


def verified_claims(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    if not jwks or not auth.startswith("Bearer "):
        raise HTTPException(401, "Sign in to continue.")
    try:
        token = auth[7:]
        key = jwks.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
            options={"require": ["exp", "sub"]},
        )
        return claims
    except Exception:
        raise HTTPException(401, "Your session could not be verified.")
