from app.services.learners.seed import seed


def login(client, email, password):
    return client.post(
        "/api/v1/auth/sign-in", json={"email": email, "password": password}
    )


def test_seed_accounts_persist_and_roles_are_isolated(clients):
    a, b, settings, _ = clients
    assert len(seed()) == 2
    password = a.get("/api/v1/auth/demo-accounts").json()["password"]
    assert login(a, "ada@wetinnext.local", password).json()["role"] == "learner"
    first = a.get("/api/v1/me").json()
    assert (
        first["profile"]["name"] == "Ada Okafor"
        and first["progress"]["1"]["status"] == "done"
    )
    assert (
        a.get("/api/v1/me/portfolio")
        .json()[0]["reflection"]
        .startswith("Sample evidence")
    )
    a.post("/api/v1/weeks/2/check-in", json={"status": "done"})
    a.post("/api/v1/auth/sign-out")
    assert login(b, "ada@wetinnext.local", password).status_code == 200
    assert b.get("/api/v1/me").json()["progress"]["2"]["status"] == "done"
    assert seed() == []
    assert login(a, "jean@wetinnext.local", password).status_code == 200
    assert a.get("/api/v1/me").json()["profile"]["name"] == "Jean Uwimana"
    assert "2" not in a.get("/api/v1/me").json()["progress"]
    assert login(a, "admin@wetinnext.local", password).json()["role"] == "admin"
    assert a.get("/api/v1/auth/session").json()["role"] == "admin"
    assert a.get("/api/v1/me").status_code == 403
    assert login(b, "ada@wetinnext.local", "wrong").status_code == 401
    settings.demo_mode = False
    assert a.get("/api/v1/auth/demo-accounts").status_code == 404
    assert login(b, "ada@wetinnext.local", password).status_code == 404
