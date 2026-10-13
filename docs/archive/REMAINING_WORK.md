# Remaining work

Updated 2026-10-12. Source freshness, saved preparation/application tracking, broader resources, onboarding, logout confirmation, automatic publication gates, AI fallback/cooldowns and a Telegram polling adapter are implemented. Last reported validation: 66 backend tests and the frontend build passed. See local development notes (excluded from the submission) for current context and [release behaviour and limitations](FUNCTIONALITY_RELEASE.md) for the earlier release.

## Next

1. Configure OpenAI credentials and evaluate real recommendations across goals, devices and time budgets.
2. Configure and activate Telegram, verify real conversations, finish setup documentation and implement secure web-account linking. Bot profiles are currently separate from web profiles.
3. Automatic requirement refresh/re-evaluation is implemented. Review uncertain drafts and confirm personal eligibility on original sources; freshness checks cannot guarantee employers are accepting applications.
4. Activate ReliefWeb with an approved application name, review HEC scholarship PDFs, and expand maintained regional employer feeds. Official local portal cards and five additional preparation tracks are implemented. See [regional expansion details](../guides/REGIONAL_SOURCES_AND_REFRESH.md).
5. Evaluate usefulness with learners and extend career templates based on their needs.

## Before public deployment

Configure and verify production authentication/roles and password recovery, disable demo mode, and add migrations, backups, rate limits, monitoring and retention controls. Deploy and operate the Telegram worker separately; live messaging remains unverified.

## Latest UI/search integration status (2026-10-12)

Implemented: shared admin/learner theme, collection pagination, optional Elasticsearch catalogue search with local fallback, and guided goal/CV workflows. See `SEARCH_AND_PAGINATION.md` for setup and practical scale limits.

OpenAI settings have been moved from the example template to the private backend environment and a model configured. Synthetic live requests currently receive HTTP 429; successful AI generation is still pending provider availability/quota resolution. No secret appears in the example template. Elasticsearch is optional and still awaits an endpoint/API key for live verification.

Build and backend regression checks pass. Latest goal/CV visual verification remains pending because browser access to local sign-in was rejected by the browser URL policy.

## Functional journey verification (2026-10-12)

Implemented and tested: resource study aids and an actual text-first filter; animated sprint-saving state; persistent weekly actions and private evidence; current-sprint portfolio; contextual check-ins; CV gap-resource links. The full gateway journey uses synthetic learners in temporary databases. Current running catalogue: 23 resources with study aids, 10 text-first options. Validation: 81 backend tests, 5 isolated frontend interaction tests and production build pass.

Live OpenAI generation remains blocked: the latest synthetic request returned HTTP 429 and the sanitised message points to quota/billing. Loaded settings are confirmed; successful generation is not. External source access/eligibility and resource data sizes are not guaranteed. Visual browser verification remains pending due to the earlier URL-policy rejection. Details: `LEARNER_JOURNEY.md`.
