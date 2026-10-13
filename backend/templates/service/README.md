# New service boilerplate

Copy this directory to `app/services/<name>` and add `__init__.py` files. Change the service name, add typed request/response contracts, implement business logic outside the route module, and introduce a repository/database owned exclusively by this service if needed.

Run with `.venv/bin/uvicorn app.services.<name>.main:app --port 8004` from `backend/`. The common factory supplies `/health`, `/api/v1/docs`, `/api/v1/redoc`, `/api/v1/openapi.json`, safe validation errors, and request IDs.

Add an explicit URL to settings and explicit public gateway routes; do not expose arbitrary upstream URLs or a catch-all proxy. Forward the caller's identity and enforce it in the owning service. Do not import another domain's models or read another domain's database.

Add gateway contract tests and independent service tests. Register the process in `scripts/dev.py` and `compose.yaml`. Review secrets and network access before deployment.
