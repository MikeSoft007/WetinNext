from test_learning_journey import PROFILE


def test_optional_branches_persist_are_private_and_goal_scoped(clients):
    client, other, _, _ = clients
    client.put("/api/v1/me/profile", json=PROFILE)
    original = client.get("/api/v1/me").json()["plan"]
    source = original["weeks"][0]["resource_id"]
    created = client.post(
        "/api/v1/me/branches",
        json={
            "title": "Audience research",
            "task": "Compare two campaign audiences",
            "resource_id": source,
        },
    )
    assert created.status_code == 200, created.text
    branch = created.json()
    assert client.get("/api/v1/me/branches").json()[0]["id"] == branch["id"]
    assert (
        other.patch(
            f"/api/v1/me/branches/{branch['id']}", json={"completed": True}
        ).status_code
        == 404
    )
    assert client.patch(
        f"/api/v1/me/branches/{branch['id']}", json={"completed": True}
    ).json()["completed"]
    assert client.get("/api/v1/me").json()["plan"] == original
    assert (
        client.post(
            "/api/v1/me/branches",
            json={
                "title": "Unknown source",
                "task": "Read something",
                "resource_id": "unrelated",
            },
        ).status_code
        == 422
    )
    client.put(
        "/api/v1/me/goal",
        json={**PROFILE, "goal": "Learn nursing", "career_track": "auto"},
    )
    assert client.get("/api/v1/me/branches").json() == []
    assert (
        client.patch(
            f"/api/v1/me/branches/{branch['id']}", json={"completed": False}
        ).status_code
        == 404
    )
    client.put("/api/v1/me/goal", json=PROFILE)
    assert client.get("/api/v1/me/branches").json()[0]["completed"]
    assert client.delete("/api/v1/me").status_code == 200
    client.post("/api/v1/demo/session")
    assert client.get("/api/v1/me/branches").json() == []
