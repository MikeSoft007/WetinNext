# REST API review

Start the local services, then open the gateway Swagger UI at `http://127.0.0.1:8000/api/v1/docs`. Import `openapi.json` into Postman or Insomnia for the current API surface. The original Postman collection and `wetinnext.http` provide starter requests; OpenAPI is authoritative for newer goal, quiz and reminder routes.

Enable the client's cookie jar. POST `/api/v1/auth/sign-in` with a seeded local email and demo password, then GET `/api/v1/me` for learners or use admin endpoints with the admin role. Do not put real secrets in saved collections. GET `/api/v1/auth/session` confirms the role. POST `/api/v1/auth/sign-out` ends the local role session.

Use `python3 scripts/export_openapi.py` from the root to refresh the export while the gateway runs. Credentials and local databases are not part of the submission.
