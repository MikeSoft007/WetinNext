# How Codex was used

The project owner supplied WetinNext's concept, intended learners, constraints and successive product decisions. Codex served as an implementation and verification collaborator. It did not originate the capstone idea.

## Concrete engineering examples

| Owner feedback | Engineering response | Inspectable evidence |
| --- | --- | --- |
| Different careers received unrelated computing resources | Exclude unrelated template filler, introduce goal-aware research beyond admin catalogue | `matching/research.py`, `matching/recommendations.py`, `test_web_research.py`, `test_intelligence.py` |
| Research vanished after refresh | Add matching-owned durable guides and owner-scoped restore | `matching/research_store.py`, persistence/erasure tests in `test_web_research.py` |
| Adding a goal replaced earlier work | Add goal snapshots and restoration, scope progress and evidence | `learners/goals.py`, `test_multiple_goals.py` |
| Re-entering goals repeated personal details | Preserve account name; prioritize verified bearer identity over anonymous demo identity | `core/security.py`, `learners/dependencies.py`, profile identity regressions |
| Practice felt static and always used a broad source link | Add configurable count/difficulty/timer, answer comparison and web-cited provider lessons | `matching/quizzes.py`, `learners/assessments.py`, `test_assessments.py`, frontend readiness tests |
| Too much scrolling | Split Today/Progress into focused sections; paginate feedback and discovery lists | `features/learner/`, `features/progress/`, `features/discovery/` |
| Repository needed grading preparation | Group frontend features, separate current docs/history and add reviewer/verification paths | Repository structure, submission docs and CI definition |

Paths in the backend columns are relative to `backend/app/` or `backend/tests/`. Frontend feature paths are relative to `web/src/`.

## Workflow

1. Read the code and reproduce the reported behavior through API or interface tests.
2. Implement the smallest change that supports the learner journey and existing role/data boundaries.
3. Add regressions for material behavior: identity isolation, goal restoration, cited links, grading and deletion.
4. Run the affected checks, then the full backend suite, frontend workflow tests and production build where appropriate.
5. Use live synthetic AI checks to expose issues mocks cannot reveal. For example, real quiz generation initially cited book indexes/prefaces; the final validator excludes them.
6. Report limits rather than treating a passing test as proof of production readiness.

Codex tools used included repository/shell operations, code editing, API orchestration, automated test execution, browser reference inspection where permitted, and original image generation. The optimized generated learning illustration is in `web/public/images/`; it is labelled as illustration rather than a photograph of a real institution.

## Evidence boundaries

The repository contains code, tests, documented decisions and reproducible commands. Local discussion notes and screenshots are excluded from Git because they are development artifacts. There was no Git repository at the start of this cleanup, so no historical commits, PR links or remote CI results are invented. A submission recording can show selected real interactions and verification output if the organizers request process evidence.
