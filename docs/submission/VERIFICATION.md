# Verification

Current verification date: 14 October 2026. Automated checks verify implementation behavior; they are not evidence of validated educational outcomes, independent source fact-checking or production scalability.

## Reproduce

From `backend/`:

```sh
.venv/bin/python -m pytest tests -q
```

From the root:

```sh
npm --prefix web test
npm --prefix web run build
npm --prefix web run format:check
```

The backend suites cover roles and identity, goal history, CV handling, source refresh, publication gates, research persistence, assessments, timer behavior, reminders, privacy and erasure. Frontend tests cover learner workflows, route actions, question controls, feedback, preparation maps and source pagination.

## Live checks completed during development

- Role sign-in for Ada, Jean and Admin through the running Vite/gateway stack.
- Synthetic goal creation/switching and profile consistency; synthetic test data deleted afterwards.
- Research guide persistence, restoration, adoption and goal-aligned CV resources.
- OpenAI generation of configurable questions and provider-specific anatomy lesson citations, with broad directory/index rejection tightened after live inspection.
- Preparation/reminder save and acknowledgement through the running API.

## Not confirmed by those checks

- Full visual QA in the local in-app browser: earlier localhost access was blocked by a tool policy. Remote reference inspection was read-only; local UI tests and builds were used instead.
- Docker runtime, public deployment, remote GitHub Actions, live Supabase signup/email delivery and live Telegram linking.
- Performance under concurrent country-scale use, accessibility certification, actual mobile-data measurement or educational efficacy.
- Every source's factual accuracy or an institution's accreditation/admission status. Source citations are traceability, not a guarantee.

The `.github/workflows/ci.yml` file defines automated checks for upload. A successful local run is not presented as a successful remote CI run. Final local verification after reorganization:

- **127 backend tests passed.** One existing Starlette/httpx deprecation warning remains.
- **45 frontend workflow tests passed.** jsdom reports its unsupported `scrollTo` method; route assertions still pass.
- **Production build and Prettier formatting checks passed.**
- **No missing local Markdown link targets.**
- Frontend source imports and test mock paths were updated after feature-folder moves; five unused legacy components were removed.
- Secrets/databases/local previews remain ignored, while environment examples and runtime images remain included.
