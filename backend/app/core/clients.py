"""Bounded HTTP contracts; services never reach into another service's database."""

import httpx
from fastapi import HTTPException, Request
from app.core.config import settings


def url(service: str):
    return getattr(settings, f"{service}_service_url").rstrip("/")


def get_catalog_resources():
    return get_catalog("/resources")


def get_catalog_opportunity(oid: str):
    return get_catalog(f"/opportunities/{oid}")


def get_catalog(path):
    try:
        result = httpx.get(url("catalog") + "/api/v1" + path, timeout=5)
        if result.status_code == 404:
            raise HTTPException(404, "Opportunity not found.")
        result.raise_for_status()
        return result.json()
    except httpx.HTTPError:
        raise HTTPException(503, "The catalogue service is temporarily unavailable.")


def forwarded_headers(request: Request):
    headers = {
        key: request.headers[key]
        for key in ["authorization", "cookie", "origin", "x-admin-key"]
        if key in request.headers
    }
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        headers["x-request-id"] = request_id
    return headers


async def service_call(
    service: str, path: str, request: Request, method="GET", payload=None
):
    try:
        timeout = (
            95 if method == "POST" and path in {"/me/assessment", "/quiz/build"} else 35
        )
        async with httpx.AsyncClient(timeout=timeout) as client:
            result = await client.request(
                method,
                url(service) + "/api/v1" + path,
                headers=forwarded_headers(request),
                json=payload,
            )
        if result.is_error:
            try:
                detail = result.json().get("detail", "Upstream service failed.")
            except ValueError:
                detail = "Upstream service failed."
            raise HTTPException(result.status_code, detail)
        return result
    except httpx.HTTPError:
        raise HTTPException(503, f"The {service} service is temporarily unavailable.")
