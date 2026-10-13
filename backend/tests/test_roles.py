import jwt
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from cryptography.hazmat.primitives.asymmetric import rsa


def test_shared_login_session_and_signout(clients):
    a, b, settings, _ = clients
    assert a.get("/api/v1/auth/session").json()["role"] == "learner"
    assert (
        a.post(
            "/api/v1/auth/sign-in",
            json={"email": settings.demo_admin_email, "password": "wrong"},
        ).status_code
        == 401
    )
    result = a.post(
        "/api/v1/auth/sign-in",
        json={"email": settings.demo_admin_email, "password": settings.admin_key},
    )
    assert result.status_code == 200
    assert "HttpOnly" in result.headers["set-cookie"]
    assert a.get("/api/v1/auth/session").json()["role"] == "admin"
    assert a.get("/api/v1/admin/learners").status_code == 200
    assert b.get("/api/v1/admin/learners").status_code == 403
    a.post("/api/v1/auth/sign-out")
    assert a.get("/api/v1/admin/learners").status_code == 403


def test_tampered_local_role_denied(clients):
    a, _, _, _ = clients
    token = jwt.encode(
        {
            "sub": "attacker",
            "role": "admin",
            "aud": "wetinnext-local",
            "iss": "wetinnext-local",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        "wrong-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        algorithm="HS256",
    )
    a.cookies.set("wetinnext_role_session", token)
    assert a.get("/api/v1/auth/session").status_code == 401
    assert a.get("/api/v1/admin/learners").status_code == 401


def test_only_verified_app_metadata_can_grant_admin(clients, monkeypatch):
    a, _, settings, _ = clients
    from app.core import security

    monkeypatch.setattr(settings, "demo_mode", False)
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(
        security,
        "jwks",
        SimpleNamespace(
            get_signing_key_from_jwt=lambda token: SimpleNamespace(
                key=private.public_key()
            )
        ),
    )

    def headers(metadata, app_metadata=None, expires=1):
        claims = {
            "sub": "test-user",
            "aud": "authenticated",
            "iss": settings.supabase_url + "/auth/v1",
            "exp": datetime.now(timezone.utc) + timedelta(hours=expires),
            "user_metadata": metadata,
            "app_metadata": app_metadata or {},
        }
        return {
            "Authorization": "Bearer " + jwt.encode(claims, private, algorithm="RS256")
        }

    user = headers({"role": "admin"})
    assert a.get("/api/v1/auth/session", headers=user).json()["role"] == "learner"
    assert a.get("/api/v1/admin/learners", headers=user).status_code == 403
    admin = headers({}, {"role": "admin"})
    assert a.get("/api/v1/auth/session", headers=admin).json()["role"] == "admin"
    assert a.get("/api/v1/admin/learners", headers=admin).status_code == 200
    assert (
        a.get(
            "/api/v1/auth/session", headers=headers({}, {"role": "admin"}, -1)
        ).status_code
        == 401
    )


def test_admin_demo_is_read_only_and_hides_learner_data(clients, monkeypatch):
    a, b, settings, _ = clients
    # A real learner name must never appear in the preview activity.
    a.put(
        "/api/v1/me/profile",
        json={
            "name": "Private learner",
            "goal": "data internship",
            "hours": 2,
            "device": "laptop",
        },
    )
    assert b.post("/api/v1/auth/admin-demo").status_code == 200
    assert b.get("/api/v1/auth/session").json()["role"] == "admin_demo"
    learners = b.get("/api/v1/admin/learners")
    assert learners.status_code == 200 and learners.json()["sample"]
    assert "Private learner" not in learners.text
    assert b.get("/api/v1/admin/content/resources").status_code == 200
    assert b.get("/api/v1/admin/sources").status_code == 200
    assert b.post("/api/v1/admin/sources/jobicy/sync").status_code == 403
    assert (
        b.put(
            "/api/v1/admin/content/resources/anything",
            json={"status": "published", "data": {}},
        ).status_code
        == 403
    )
    b.post("/api/v1/auth/sign-out")
    assert b.get("/api/v1/admin/learners").status_code == 403
    monkeypatch.setattr(settings, "demo_mode", False)
    assert b.post("/api/v1/auth/admin-demo").status_code == 404
