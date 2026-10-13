# WetinNext

**Turn a learning ambition into sourced learning, practical evidence and a clearer next opportunity.**

WetinNext is a working proof of concept for university students and self-taught learners, initially focused on Nigeria and Rwanda, with a Global discovery scope. The learner chooses a goal and constraints; the system researches relevant free learning and training routes, builds an introductory four-week plan, and connects practice, CV review and opportunity preparation in one goal workspace.

The project concept and learner requirements came from the project owner. Codex was used to implement, debug, test and refine the solution.

## Start here for grading

| Rubric | Weight | Review evidence |
| --- | --- | --- |
| Uniqueness | 25% | [Problem, approach and differentiators](docs/submission/RUBRIC.md#uniqueness-25) |
| Scalability | 25% | [Geographic expansion and current limits](docs/submission/SCALABILITY.md) |
| Codex usage | 25% | [Engineering workflow and concrete examples](docs/submission/CODEX_USAGE.md) |
| Presentation | 25% | [Five-minute demonstration](docs/submission/DEMO.md) and [verification](docs/submission/VERIFICATION.md) |

**Reviewer route:** read the rubric map → run the app → sign in to a seeded learner → follow the demo → inspect the feature folders and tests. Older milestone documents are clearly separated in `docs/archive/`.

## What works

- Multiple saved goals with independent plans, weekly progress and evidence.
- Web-researched learning guides beyond the admin catalogue, with traceable sources and location scope.
- Four-week introductory plans, weekly work and check-ins; unsupported goals do not receive unrelated computing templates.
- Configurable practice quizzes: 1–20 questions, three difficulty levels, optional timer, answer comparison and cited lesson links.
- A preparation signal map, CV feedback, application preparation tracking and per-goal in-app focus reminders.
- Separate learner/admin roles, persistent local demo accounts, account-data deletion and versioned REST APIs.
- Curated catalogue imports, freshness checks, publication gates and explicit AI fallback/error states.

Four weeks is a starting sprint, not a promise of professional qualification or job readiness. Practice scores and saved work are learning signals. Openings, admission, accreditation and eligibility must be confirmed with the original provider.

## Run locally

Requires Python 3.11+, Node.js 22+, and free ports 8000–8003 and 5173.

```sh
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
npm --prefix web ci
```

In `backend/.env`, set a long random `ADMIN_KEY` for signing local sessions. Set `OPENAI_API_KEY` and `OPENAI_MODEL` for live research and practice generation. These values stay server-side. Leave the blank example templates safe to commit.

```sh
python3 scripts/seed_demo.py
python3 scripts/dev.py
```

In another terminal:

```sh
npm --prefix web run dev
```

Open [WetinNext](http://127.0.0.1:5173/sign-in). Under **Use a saved demo account**, choose Ada, Jean or Admin. Alternatively use the shared local demo password `WetinNextDemo!2026`:

| Account | Email | Workspace |
| --- | --- | --- |
| Ada Okafor | `ada@wetinnext.local` | Nigeria learner, frontend starter plan |
| Jean Uwimana | `jean@wetinnext.local` | Rwanda learner, data starter plan |
| WetinNext Admin | `admin@wetinnext.local` | Administrative workspace |

Seeding inserts missing sample learners without resetting existing edits. Sample evidence is labelled. Local seeded credentials are disabled when `DEMO_MODE=false`; registered accounts require the configured Supabase provider. See [account setup](docs/guides/DEMO_ACCOUNTS.md).

## Repository map

```text
.github/workflows/       Automated verification definition
backend/
  app/
    core/                Configuration, identity, shared HTTP clients
    contracts/           Validated REST request/response schemas
    gateway/             Public /api/v1 composition and sign-in
    services/
      learners/          Profiles, goals, plans, evidence, CVs, quizzes
      catalog/           Sources, ingestion, publication and freshness
      matching/          Research, matching and lesson-based quiz generation
    integrations/        Telegram polling adapter
  templates/service/     Reusable service boilerplate
  tests/                 Domain-named backend regression suites
web/
  src/
    app/                 Application shell and section routing
    features/            Learner, discovery, goals, learning, progress,
                         opportunities, CV and admin interfaces
    shared/              API client, types, UI and illustrations
    styles/              Existing ordered stylesheet layers
  public/images/         Runtime image assets
  tests/                 Learner workflow and interaction tests
scripts/                 Local launcher, demo seeding and schema export
docs/
  submission/            Rubric map, Codex evidence, demo and verification
  architecture/          Current system boundaries and ownership
  guides/                Detailed feature implementation notes
  api/                   OpenAPI, Postman and REST-client artifacts
  examples/              Synthetic example CV
  archive/               Historical specifications and milestone notes
```

Local previews, secrets, databases, logs and dependencies are ignored. Runtime images, dependency lockfiles and blank environment examples remain included.

## Architecture and API

| Service | Port | Entry point | Owns |
| --- | --- | --- | --- |
| Gateway | 8000 | `app.main:app` | Public API composition and local role sign-in |
| Learner | 8001 | `app.services.learners.main:app` | Learner/goal data and assessments |
| Catalogue | 8002 | `app.services.catalog.main:app` | Sources, resources and opportunities |
| Matching | 8003 | `app.services.matching.main:app` | AI research and matching; durable research guides |

Services communicate through HTTP contracts. SQLite files are local prototype storage, not production distributed persistence. Read the [current architecture](docs/architecture/README.md) and [scalability assessment](docs/submission/SCALABILITY.md).

- [Swagger API tools](http://127.0.0.1:8000/api/v1/docs)
- [Live OpenAPI schema](http://127.0.0.1:8000/api/v1/openapi.json)
- [Postman and REST-client files](docs/api/README.md)
- Refresh the saved schema with `python3 scripts/export_openapi.py` while the gateway is running.

`docker compose up --build` is an alternative backend launcher. Docker execution has not been verified here; its volumes are separate from local SQLite files.

## Verify

```sh
cd backend
.venv/bin/python -m pytest tests -q
```

From the repository root:

```sh
npm --prefix web test
npm --prefix web run build
npm --prefix web run format:check
```

[Verification notes](docs/submission/VERIFICATION.md) distinguish automated tests, live AI checks and pending visual/deployment checks. The GitHub Actions workflow defines these checks; no remote CI run is claimed before upload.

## Proof-of-concept boundaries

English-first; Nigerian Pidgin, French and other languages are future work. Maps show regional context, not verified institution pins. Reminders are in-app, not background email/push. Telegram has a polling adapter but live account linking and credentials verification remain pending. LinkedIn support is a goal-specific search/review bridge, not a scraping or bulk-ingestion integration. Research and quizzes require available model access; AI-generated practice is not a validated exam. See the [full reviewer guide](docs/README.md) for details.
