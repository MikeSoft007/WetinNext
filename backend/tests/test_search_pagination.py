"""Search must preserve visibility, geography, privacy and pagination during outages."""

import base64
import json
import httpx
import pytest
from app.services.catalog import search

ADMIN = {"X-Admin-Key": "test-admin-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}


@pytest.fixture(autouse=True)
def reset_search(monkeypatch):
    monkeypatch.setattr(search, "_FINGERPRINT", "")
    monkeypatch.setattr(search, "_RETRY_AFTER", 0)


def add(
    client, identifier, country="Nigeria", status="published", title="Python internship"
):
    payload = {
        "title": title,
        "organisation": "Example Academy",
        "type": "Internship",
        "country": country,
        "skills": ["Python", "Research"],
        "description": "Build introductory tools",
        "mandatory": "Confirm residency",
        "sample": False,
        "url": "https://example.com/" + identifier,
        "deadline": "2099-12-31",
    }
    response = client.put(
        "/api/v1/admin/content/opportunities/" + identifier,
        headers=ADMIN,
        json={"status": status, "data": payload},
    )
    assert response.status_code == 200, response.text
    return payload


def test_search_pages_filters_typos_and_boundaries(clients):
    client, _, _, _ = clients
    for i in range(8):
        add(client, "page-" + str(i), title="Python internship " + str(i))
    add(client, "other-market", "Rwanda")
    add(client, "draft-only", status="draft")
    first = client.get(
        "/api/v1/search?country=Nigeria&q=pythn&live_only=true&page_size=3"
    ).json()
    second = client.get(
        "/api/v1/search?country=Nigeria&q=pythn&live_only=true&page_size=3&page=2"
    ).json()
    assert first["total"] == 8 and first["pages"] == 3 and len(first["items"]) == 3
    assert not {r["id"] for r in first["items"]} & {r["id"] for r in second["items"]}
    assert all(r["country"] == "Nigeria" for r in first["items"] + second["items"])
    assert (
        client.get(
            "/api/v1/search?q=pythn&country=Nigeria&page_size=3&page=999"
        ).json()["page"]
        == 3
    )
    assert client.get("/api/v1/search?page=0").status_code == 422
    assert client.get("/api/v1/search?page_size=500").status_code == 422
    assert client.get("/api/v1/search?country=invalid").status_code == 422
    assert client.get("/api/v1/admin/search").status_code == 403
    result = client.get(
        "/api/v1/admin/search?q=pythn&status=draft", headers=ADMIN
    ).json()
    assert [r["id"] for r in result["items"]] == ["draft-only"]
    assert client.get("/api/v1/search?q=unfindable").json()["total"] == 0
    resources = client.get("/api/v1/search?kind=resources&q=pyth").json()
    assert resources["total"] > 0 and all("provider" in r for r in resources["items"])


def test_elasticsearch_refresh_and_canonical_visibility(clients, monkeypatch):
    client, _, settings, _ = clients
    payload = add(client, "indexed")
    add(client, "hidden", status="draft")
    settings.elasticsearch_url = "https://search.example.test"
    original = httpx.Client
    calls = []

    def respond(request):
        calls.append(request)
        if request.url.path == "/_bulk":
            return httpx.Response(200, json={"errors": False})
        body = json.loads(request.content)
        assert (
            "opportunities:hidden"
            not in body["query"]["bool"]["filter"][0]["ids"]["values"]
        )
        return httpx.Response(
            200,
            json={
                "hits": {
                    "hits": [
                        {"_id": "opportunities:indexed"},
                        {"_id": "opportunities:hidden"},
                    ]
                }
            },
        )

    monkeypatch.setattr(
        search.httpx,
        "Client",
        lambda **kw: original(transport=httpx.MockTransport(respond), **kw),
    )
    result = client.get("/api/v1/search?q=Python&country=Nigeria").json()
    assert result["engine"] == "elasticsearch"
    assert [r["id"] for r in result["items"]] == ["indexed"]
    client.get("/api/v1/search?q=Python&country=Nigeria")
    assert len([r for r in calls if r.url.path == "/_bulk"]) == 1
    payload["title"] = "Updated Python internship"
    client.put(
        "/api/v1/admin/content/opportunities/indexed",
        headers=ADMIN,
        json={"status": "published", "data": payload},
    )
    result = client.get("/api/v1/search?q=Python&country=Nigeria").json()
    assert result["items"][0]["title"] == "Updated Python internship"
    assert len([r for r in calls if r.url.path == "/_bulk"]) == 2
    # Index only the approved catalogue fields, never source snapshots or learner data.
    bulk = "\n".join(r.content.decode() for r in calls if r.url.path == "/_bulk")
    assert (
        "extracted_preview" not in bulk
        and "learner_id" not in bulk
        and "source_snapshot" not in bulk
    )


@pytest.mark.parametrize("failure", ["offline", "partial", "bulk-error"])
def test_elasticsearch_failure_uses_local_fallback(clients, monkeypatch, failure):
    client, _, settings, _ = clients
    add(client, "fallback")
    settings.elasticsearch_url = "https://search.example.test"
    original = httpx.Client
    calls = []

    def respond(request):
        calls.append(request)
        if failure == "offline":
            raise httpx.ConnectError("offline", request=request)
        if request.url.path == "/_bulk":
            return httpx.Response(200, json={"errors": failure == "bulk-error"})
        return httpx.Response(200, json={"timed_out": True, "hits": {"hits": []}})

    monkeypatch.setattr(
        search.httpx,
        "Client",
        lambda **kw: original(transport=httpx.MockTransport(respond), **kw),
    )
    result = client.get("/api/v1/search?q=pythn&country=Nigeria").json()
    assert result["engine"] == "local" and any(
        r["id"] == "fallback" for r in result["items"]
    )
    count = len(calls)
    client.get("/api/v1/search?q=pythn&country=Nigeria")
    assert len(calls) == count  # Outage cooldown prevents repeated slow requests.


def test_private_cv_pagination_and_admin_auth(clients):
    client, other, _, _ = clients
    text = "Education University student. Skills Python SQL. Projects Research tracker. Experience Helped 100 students with spreadsheets."
    for i in range(8):
        assert (
            client.post(
                "/api/v1/me/cv-reviews",
                json={
                    "filename": f"cv-{i}.txt",
                    "content_base64": base64.b64encode(text.encode()).decode(),
                    "goal": "Python internship",
                },
            ).status_code
            == 200
        )
    first = client.get("/api/v1/me/cv-reviews?page=1&page_size=3&q=pythn").json()
    second = client.get("/api/v1/me/cv-reviews?page=2&page_size=3&q=pythn").json()
    assert first["total"] == 8 and len(second["items"]) == 3
    assert not {r["id"] for r in first["items"]} & {r["id"] for r in second["items"]}
    assert other.get("/api/v1/me/cv-reviews?page=1").json()["total"] == 0
    assert client.get("/api/v1/admin/learners?page=1").status_code == 403
    learners = client.get(
        "/api/v1/admin/learners?page=1&page_size=1", headers=ADMIN
    ).json()
    assert learners["total"] >= 2 and len(learners["items"]) == 1
    assert set(learners["items"][0]) == {
        "id",
        "name",
        "country",
        "learner_type",
        "has_pathway",
        "completed",
    }
    add(client, "audit-test")
    audit = client.get(
        "/api/v1/admin/audit?page=1&page_size=1&q=audit-test", headers=ADMIN
    ).json()
    assert audit["total"] == 1 and audit["items"][0]["content_id"] == "audit-test"
