"""Short-lived service credentials; Telegram never gains administrator privileges."""

import hashlib
import hmac
from datetime import datetime, timezone, timedelta
import jwt
from fastapi import HTTPException
from app.core.config import settings


def issue(user_id):
    if len(settings.telegram_service_secret) < 32:
        raise ValueError(
            "Configure TELEGRAM_SERVICE_SECRET with at least 32 random characters"
        )
    subject = (
        "telegram:"
        + hmac.new(
            settings.telegram_service_secret.encode(),
            str(user_id).encode(),
            hashlib.sha256,
        ).hexdigest()
    )
    return jwt.encode(
        {
            "sub": subject,
            "iss": "wetinnext-telegram",
            "aud": "wetinnext-learner",
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        settings.telegram_service_secret,
        algorithm="HS256",
    )


def verify(auth):
    if not auth.startswith("Telegram "):
        return None
    try:
        if len(settings.telegram_service_secret) < 32:
            raise ValueError()
        data = jwt.decode(
            auth[9:],
            settings.telegram_service_secret,
            algorithms=["HS256"],
            audience="wetinnext-learner",
            issuer="wetinnext-telegram",
            options={"require": ["sub", "iat", "exp"]},
        )
        if not data["sub"].startswith("telegram:") or len(data["sub"]) != 73:
            raise ValueError()
        return data["sub"]
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(401, "Telegram service session could not be verified")
