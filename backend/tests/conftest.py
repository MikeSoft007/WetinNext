import asyncio
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine


@pytest.fixture
def clients(tmp_path, monkeypatch):
    from app.core.config import settings
    from app.core import clients as service_clients
    from app.services.learners import database
    from app.services.learners import main as learner_main
    from app.services.catalog.main import app as catalog_app
    from app.services.matching.main import app as matching_app
    from app.gateway.api.v1 import routes as gateway_routes
    from app.services.matching.api.v1 import routes as matching_routes
    from app.services.learners.models import Base
    from app.main import app as gateway_app
    from app.services.learners import pathways

    engine = create_engine(
        f"sqlite:///{tmp_path}/test.db", connect_args={"check_same_thread": False}
    )
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(learner_main, "engine", engine)
    monkeypatch.setattr(settings, "catalog_database", str(tmp_path / "catalog.db"))
    monkeypatch.setattr(settings, "research_database", str(tmp_path / "research.db"))
    monkeypatch.setattr(
        settings, "admin_key", "test-admin-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    )
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "auto_ingest", False)
    monkeypatch.setattr(settings, "auto_publish", False)
    # Scheduler behaviour is exercised explicitly in tests; prevent startup races
    # with publication assertions when a test turns automatic publication on.
    from app.services.catalog import automatic

    async def idle_refresh():
        await asyncio.Event().wait()

    monkeypatch.setattr(automatic, "refresh_loop", idle_refresh)

    monkeypatch.setattr(settings, "elasticsearch_url", "")
    monkeypatch.setattr(settings, "openai_api_key", "")
    Base.metadata.create_all(engine)
    with (
        TestClient(learner_main.app) as lc,
        TestClient(catalog_app) as cc,
        TestClient(matching_app) as mc,
    ):
        services = {"learner": lc, "catalog": cc, "matching": mc}

        async def service_call(service, path, request, method="GET", payload=None):
            # Real service clients are per-request and do not share cookie jars.
            services[service].cookies.clear()
            result = services[service].request(
                method,
                "/api/v1" + path,
                headers=service_clients.forwarded_headers(request),
                json=payload,
            )
            if result.is_error:
                from fastapi import HTTPException

                raise HTTPException(result.status_code, result.json()["detail"])
            return result

        def catalogue(path):
            result = cc.get("/api/v1" + path)
            if result.is_error:
                from fastapi import HTTPException

                raise HTTPException(result.status_code, result.json()["detail"])
            return result.json()

        monkeypatch.setattr(gateway_routes, "service_call", service_call)
        monkeypatch.setattr(matching_routes, "service_call", service_call)
        monkeypatch.setattr(service_clients, "get_catalog", catalogue)
        from app.services.learners import cv

        monkeypatch.setattr(cv, "get_catalog", catalogue)
        with TestClient(gateway_app) as a, TestClient(gateway_app) as b:
            a.post("/api/v1/demo/session")
            b.post("/api/v1/demo/session")
            yield a, b, settings, pathways
    engine.dispose()
