# WetinNext

**Turn a learning ambition into sourced learning, practical evidence and a clearer next opportunity.**

WetinNext is a working proof of concept for university students and self-taught learners, initially focused on Nigeria and Rwanda, with a Global discovery scope. The learner chooses a goal and constraints; the system researches relevant free learning and training routes, builds an introductory four-week plan, and connects practice, CV review and opportunity preparation in one goal workspace.

Codex supported the implementation, debugging, testing and refinement of WetinNext.

## Built with Codex

**Codex helped build and verify WetinNext**, implementing core features, investigating failures and refining the learner experience through repeated testing and feedback.

- **Goal-specific AI discovery:** implemented web-grounded research, traceable provider links and bounded follow-up searches when schools or opportunities were missing. Feedback about unrelated recommendations led to stronger goal and location handling. See [research implementation](backend/app/services/matching/research.py) and [research regressions](backend/tests/test_web_research.py).
- **A connected learner journey:** consolidated Discover, Progress and Review; built weekly topic reviews, saved work evidence, learning extensions and application comparisons. See [learner workspace](web/src/features/learner/LearnerWorkspace.tsx).
- **Persistent, personal progress:** added multiple-goal history, consistent profile identity and durable research restoration, then investigated failures through API checks and regression tests.
- **Practical verification:** ran synthetic end-to-end API rehearsals and live model searches, and added automated checks for material behavior. The latest full local run passed **127 backend tests and 45 frontend tests**, alongside the production build and formatting checks.
- **Reviewable delivery:** organized feature folders, maintained API documentation and prepared pull requests with CI checks. Codex also documented limitations instead of presenting source citations, quiz scores or CV mentions as verified career readiness.

See [Codex usage and engineering examples](docs/submission/CODEX_USAGE.md) and [verification boundaries](docs/submission/VERIFICATION.md). The supporting implementation, tests and engineering decisions are available in this repository.

## Project documentation

- [Architecture and service boundaries](docs/architecture/README.md)
- [Geographic expansion and current limits](docs/submission/SCALABILITY.md)
- [Codex engineering contribution](docs/submission/CODEX_USAGE.md)
- [Verification and limitations](docs/submission/VERIFICATION.md)

Start with the setup instructions below, then explore Discover, Progress and Review using a seeded learner account. Feature folders and tests document the implementation; `docs/archive/` contains older milestone notes.

## What works

- Multiple saved goals with independent plans, weekly progress and evidence.
- Remembered learning picks with Saved/Reading/Read states and a Today resume view.
- Weekly workspaces pair the cited resource with a concrete exercise and success artifact; a private notepad expands when selected to capture an idea, while practice examples and open questions remain available as optional evidence for the Progress portfolio.
- The learner workspace has three core tabs: Discover researches the active goal, compares free and optional paid sources, institutions and evidenced openings, then offers a four-week starter plan; Progress resumes reading, records work/skill evidence and practice checks, and extends learning through optional goal-scoped branches; Review compares uploaded CVs or pasted résumé/website content with the active goal. A location dropdown scopes Nigeria, Rwanda or Global research. Streamed draft orientation is displayed through polling as the model generates it; links remain hidden until source validation finishes. This is a starter pathway, not a promise of qualification or employment. Website URLs alone are not fetched or reviewed.
- Web-researched learning guides beyond the admin catalogue, with citation-checked direct source links and location scope. Each guide returns at most five local providers and five current calls; opportunities without dated current evidence are omitted. Opportunity cards compare source-listed skills with CV/profile mentions and completed guide practice as evidence coverage, not a readiness or hiring prediction.
- Four-week introductory plans, weekly work and check-ins; unsupported goals do not receive unrelated computing templates.
- Configurable practice quizzes: 1–20 questions, three difficulty levels, optional timer, answer comparison and cited lesson links. The guide's assessment tab keeps the readiness and practice entry visible before and after a researched plan is saved.
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
  submission/            Codex evidence, scalability and verification
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

## What comes next

- **A robust learning library:** expand the searchable collection of credible courses, ebooks, open textbooks, library collections and training providers. Organize resources by career goal, skill, level, location and free or paid access so learners can find what supports their next step.
- **Continuously refreshed opportunity listings:** develop regular source refresh and availability checks for jobs, internships, scholarships and admissions, with application links, deadlines and goal-based preparation guidance. The aim is timely, relevant listings that help learners progress towards their goals. Current web research is on demand; a comprehensive real-time listing service is future work.
- **Phone-based continuity through Telegram:** enable learners to receive next actions, record check-ins and stay engaged from their phones.

## Proof-of-concept boundaries

English-first; Nigerian Pidgin, French and other languages are future work. Maps show regional context, not verified institution pins. Reminders are in-app, not background email/push. Telegram is a future phone-based check-in and guidance feature. Its polling adapter is a scaffold; live account linking and delivery are not yet implemented or verified. LinkedIn support is a goal-specific search/review bridge, not a scraping or bulk-ingestion integration. Research and quizzes require available model access; AI-generated practice is not a validated exam. See the [full reviewer guide](docs/README.md) for details.

### Career bank and journey records

Discover includes a searchable, paginated career bank backed by the European Commission ESCO classification. The live API returned 2,942 occupation profiles in the verified default search. Definitions and core skills are occupational references; local education/licensing and current vacancies are separately researched for the learner’s goal and market. The catalogue service caches bounded pages and can reuse a cached page during an upstream failure; this cache is in memory and does not provide offline access after restart.

Progress’s Journey log records active-goal work, check-ins, completed practice checks, experience reviews and optional branches. Work/practice records refer to the current sprint; reviews and check-ins are goal-scoped. This is evidence and self-reported activity, not a certified competence score.
