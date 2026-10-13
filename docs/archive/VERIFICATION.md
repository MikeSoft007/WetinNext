# Verification — 11 October 2026

## Passed

- Frontend TypeScript check and Vite production build.
- 12 backend contract/regression tests spanning the gateway and three domain services.
- Real HTTP smoke across ports 8000–8003: demo sessions, identity isolation, profile/pathway creation, check-ins, history, future-task adjustment, matching, catalogue filtering, OpenAPI and deletion of the disposable test learners.
- Browser: preserved existing Ada profile/pathway and completed week, Rwanda market filtering, SQL search empty state, legacy check-in journal entry, and restored Nigeria dashboard.
- Phone DOM layout check: document width 375 px, scroll width 375 px.
- Temporary browser viewport restored; local preview remains available.

## Limits

- Docker Compose configuration validates. The Docker daemon is not running, so container startup and image builds are not runtime-verified.
- Live OpenAI, Supabase sign-in, PostgreSQL and Telegram messaging were not tested or connected.
- Internal contract tests substitute service HTTP with independent service TestClients. A separate real-HTTP smoke exercised actual network wiring.
- The test runner emits an upstream Starlette/httpx deprecation warning; all tests pass.
- Screenshot capture under a viewport override may crop in the in-app browser; the normal viewport was restored before the handoff.
- Opportunities remain synthetic practice examples and the catalogue remains read-only.
