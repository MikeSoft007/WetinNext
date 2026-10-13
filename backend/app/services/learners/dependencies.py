import json
from fastapi import Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.security import identity
from .database import db
from .models import Learner


def learner(
    request: Request, user: str = Depends(identity), session: Session = Depends(db)
):
    record = session.get(Learner, user)
    if record is None:
        record = Learner(id=user)
        session.add(record)
        try:
            session.commit()
        except IntegrityError:
            # Parallel /me, history and discovery requests can bootstrap the
            # same identity after erasure. Reuse the row that won the insert.
            session.rollback()
            record = session.get(Learner, user)
            if record is None:
                raise
        session.refresh(record)
    profile = json.loads(record.profile)
    claims = getattr(request.state, "auth_claims", {})
    metadata = claims.get("user_metadata") or {}
    name = metadata.get("full_name", "") if isinstance(metadata, dict) else ""
    if not profile.get("name") and isinstance(name, str) and name.strip():
        profile["name"] = name.strip()[:80]
        record.profile = json.dumps(profile)
        session.commit()
    return record
