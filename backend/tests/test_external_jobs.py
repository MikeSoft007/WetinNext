import base64


def test_external_review_uses_own_cv_and_never_fetches_link(clients, monkeypatch):
    client, other, _, _ = clients
    from app.services.learners import external_jobs

    calls = []
    monkeypatch.setattr(
        external_jobs,
        "get_catalog_resources",
        lambda: (
            calls.append("catalog")
            or [{"id": "linux", "skills": ["Linux"], "cost": "Free", "format": "Text"}]
        ),
    )
    cv = "Education University student. Skills Python. Projects Built a Python tool. Experience Helped 100 students using a project tracker."
    assert (
        client.post(
            "/api/v1/me/cv-reviews",
            json={
                "filename": "test.txt",
                "content_base64": base64.b64encode(cv.encode()).decode(),
                "goal": "Infrastructure engineer",
            },
        ).status_code
        == 200
    )
    body = {
        "url": "https://www.linkedin.com/jobs/view/123",
        "description": "A fictional entry level infrastructure role. Requirements include Python and Linux. Confirm employer requirements, location and eligibility before applying.",
    }
    response = client.post("/api/v1/me/external-job-review", json=body)
    assert response.status_code == 200, response.text
    assert response.json()["supported"] == ["Python"]
    assert response.json()["gaps"] == ["Linux"]
    assert response.json()["resources"][0]["id"] == "linux"
    assert "unverified" in response.json()["notice"]
    assert (
        other.post("/api/v1/me/external-job-review", json=body).json()["supported"]
        == []
    )
    assert calls == ["catalog", "catalog"]
    for url in [
        "https://linkedin.com.evil.test/jobs/view/1",
        "http://linkedin.com/jobs/view/1",
        "https://user:pass@linkedin.com/jobs/view/1",
        "https://127.0.0.1/jobs/view/1",
    ]:
        assert (
            client.post(
                "/api/v1/me/external-job-review", json={**body, "url": url}
            ).status_code
            == 422
        )
    assert (
        client.post(
            "/api/v1/me/external-job-review", json={**body, "description": "tiny"}
        ).status_code
        == 422
    )
