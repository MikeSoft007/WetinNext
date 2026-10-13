import asyncio
import json
import pytest
import httpx
from app.services.catalog import publication, ingestion
from app.services.catalog.store import items, save
from app.services.matching import intelligence
from app.services.matching.recommendations import recommend
from app.core.telegram_identity import issue
from app.integrations.telegram import Bot, StateStore, telegram
from test_admin_cv import ADMIN
from test_tracking_refresh import job


def test_auto_publication_gates_and_manual_preservation(clients):
    a, _, settings, _ = clients
    settings.auto_publish = True
    ingestion.persist_records(
        "remotive",
        [
            job(),
            {**job(102), "title": "Senior Python engineer"},
            {**job(103), "country": "Other"},
        ],
    )
    resource = ingestion.normalize_resource(
        {"dashedName": "responsive-web-design", "name": "Responsive web design"}
    )
    ingestion.persist_records("freecodecamp", [resource])
    assert publication.publish_qualified() == 2
    public = items("opportunities")
    live = next(r for r in public if r["id"] == "remotive-101")
    assert (
        live["deadline_unknown_confirmed"] and live["publication_mode"] == "automatic"
    )
    assert not any(r["id"] in ["remotive-102", "remotive-103"] for r in public)
    save("opportunities", job(), "draft")
    ingestion.persist_records("remotive", [job()])
    assert publication.publish_qualified() == 0
    assert not any(r["id"] == "remotive-101" for r in items("opportunities"))
    source_settings = a.put(
        "/api/v1/admin/source-settings",
        headers=ADMIN,
        json={"enabled": True, "auto_publish": False},
    )
    assert (
        source_settings.status_code == 200
        and not source_settings.json()["auto_publish"]
    )
    assert (
        a.put(
            "/api/v1/admin/source-settings",
            json={"enabled": True, "auto_publish": True},
        ).status_code
        == 403
    )


def test_automatic_publication_rejects_uncertain_and_untrusted(clients):
    _, _, settings, _ = clients
    settings.auto_publish = True
    ingestion.persist_records("remotive", [{**job(), "availability": "unknown"}])
    # Persisted feed facts assert listed, so invalidate observation explicitly for this check.
    assert publication.rejection(
        "opportunities",
        {
            **job(),
            "source_seen_at": "2000-01-01T00:00:00+00:00",
            "availability": "listed",
        },
    )
    assert publication.rejection(
        "opportunities", {**job(), "url": "https://untrusted.example/job"}
    )
    assert publication.rejection(
        "resources",
        {
            "title": "Paid material",
            "url": "https://www.freecodecamp.org/learn/test/",
            "id": "fcc-test",
            "source": "freeCodeCamp",
            "cost": "Paid",
        },
    )


def test_fallback_custom_aspiration_and_gap_actions():
    profile = {
        "goal": "cybersecurity analyst",
        "country": "Nigeria",
        "hours": 1,
        "device": "phone",
    }
    result = recommend(
        {"profile": profile},
        [],
        [
            {
                "id": "ibm",
                "title": "Cybersecurity foundations",
                "skills": ["Cybersecurity"],
                "device": "phone or laptop",
                "cost": "Free",
                "format": "Text",
            }
        ],
        [
            {
                "id": "job",
                "title": "Cybersecurity intern",
                "country": "Global",
                "skills": ["Cybersecurity"],
                "sample": False,
            }
        ],
    )
    assert result["track"] == "cybersecurity"
    assert result["resources"][0]["resource"]["id"] == "ibm"
    match = result["opportunities"][0]
    assert (
        match["learning_resource"]["id"] == "ibm"
        and match["minutes"] <= 60
        and "Cybersecurity" in match["next_action"]
    )
    assert match["evidence_to_clarify"] == ["Cybersecurity"]


def test_shared_model_cooldown_across_inputs(clients, monkeypatch):
    _, _, settings, _ = clients
    settings.openai_api_key = "mock"
    settings.openai_model = "test-cooldown"
    intelligence._CACHE.clear()
    intelligence._LOCKS.clear()
    intelligence._COOLDOWN.clear()
    intelligence._COOLDOWN_REASON.clear()
    intelligence._FAILURES.clear()
    intelligence._FAILURE_REASONS.clear()
    monkeypatch.setattr(intelligence, "_LIMIT", asyncio.Semaphore(2))
    calls = []

    class Limited(Exception):
        status_code = 429
        response = type("Response", (), {"headers": {"retry-after": "120"}})()

    async def unavailable(*args):
        calls.append(1)
        raise Limited()

    monkeypatch.setattr(intelligence, "parse_output", unavailable)

    async def run():
        for goal in ["frontend developer", "backend developer", "backend developer"]:
            result = await intelligence.discover(
                {
                    "profile": {"goal": goal, "hours": 1, "country": "Nigeria"},
                    "progress": {},
                },
                [],
                items("resources"),
                items("opportunities"),
            )
            assert result["engine"] == "rule-based fallback" and result["resources"]
            assert result["fallback_reason"] == "AI rate/quota limit (HTTP 429)"

    asyncio.run(run())
    assert len(calls) == 1
    intelligence._CACHE.clear()
    intelligence._LOCKS.clear()
    intelligence._COOLDOWN.clear()
    intelligence._COOLDOWN_REASON.clear()
    intelligence._FAILURES.clear()
    intelligence._FAILURE_REASONS.clear()


def test_telegram_journey_isolated_identity_and_retry_safe(clients, tmp_path):
    a, b, settings, _ = clients
    settings.telegram_service_secret = (
        "test-service-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    )
    store = StateStore(str(tmp_path / "bot.db"))

    async def rest(user, path, method="GET", payload=None):
        response = a.request(
            method,
            "/api/v1" + path,
            json=payload,
            headers={"Authorization": "Telegram " + issue(user)},
        )
        if response.is_error:
            raise ValueError(response.json()["detail"])
        return response.json()

    bot = Bot(store, rest)

    async def run():
        assert "What would you" in await bot.handle(123, "/start")
        assert "Nigeria" in await bot.handle(123, "frontend developer")
        await bot.handle(123, "Nigeria")
        assert "1 to 20" in await bot.handle(123, "99")
        await bot.handle(123, "2")
        assert "/confirm" in await bot.handle(123, "phone")
        result = await bot.handle(123, "/confirm")
        assert "Week 1" in result and "implementation" in result.lower()
        assert "Learn:" in await bot.handle(123, "/matches")
        await bot.handle(123, "/done", 100)
        await bot.handle(123, "/done", 100)
        me = await rest(123, "/me")
        assert list(me["progress"]) == ["1"]
        other = await rest(456, "/me")
        assert other["plan"] is None
        assert b.get("/api/v1/me").json()["plan"] is None
        assert (
            a.get(
                "/api/v1/admin/learners",
                headers={"Authorization": "Telegram " + issue(123)},
            ).status_code
            == 403
        )
        store.remember(100, "Private saved reply", 123)
        await bot.handle(123, "/forget")
        assert "deleted" in await bot.handle(123, "/confirmdelete")
        assert store.reply(100) is None
        assert (await rest(123, "/me"))["plan"] is None

    asyncio.run(run())
    assert (
        a.get("/api/v1/me", headers={"Authorization": "Telegram invalid"}).status_code
        == 401
    )


def test_telegram_transport_and_cursor(tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "telegram_bot_token", "mock-token")
    requests = []

    def upstream(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "result": {"message_id": 1}})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(upstream)) as client:
            await telegram(client, "sendMessage", {"chat_id": 123, "text": "Next task"})

    asyncio.run(run())
    assert requests == [{"chat_id": 123, "text": "Next task"}]
    store = StateStore(str(tmp_path / "state.db"))
    store.remember(12, "Saved reply", 123)
    store.advance(12)
    store.advance(10)
    assert store.offset() == 13 and store.reply(12)[0] == "Saved reply"
