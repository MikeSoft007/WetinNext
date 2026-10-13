# Public sources and discovery logic

Implemented October 11, 2026. Gateway REST contract: `/api/v1`.

## Available sources

- Jobicy: public remote jobs, no API key. Attribution and canonical links are required. Imports request up to 100 records from the first worldwide feed page; this is not a complete job database. Nigerian/Rwandan eligibility must still be checked. Documentation: https://github.com/Jobicy/remote-jobs-api
- freeCodeCamp: public GraphQL curriculum metadata. Alpha API can change; seven known curriculum slugs are allowlisted. Only metadata and course links are imported, not lesson content. https://curriculum-db.freecodecamp.org/
- Microsoft Learn: free catalogue API requires onboarding/authentication; not connected. https://learn.microsoft.com/en-us/training/support/integrations-learn-platform-api-catalog
- ReliefWeb: useful humanitarian jobs/training, requires an approved app name; not connected. https://apidoc.reliefweb.int/
- MDN and Python official tutorials: curated seed links, no scraping.

## Import and publication

1. Admin signs in through the same flow as learners; backend roles control access.
2. GET `/admin/sources` displays connection status and last attempt.
3. POST `/admin/sources/jobicy/sync` or `/admin/sources/freecodecamp/sync` imports new drafts. Fixed upstream hosts, bounded responses, persistent one-hour attempt cooldown, insert-only IDs, and an audit entry protect editorial decisions. Upstream errors preserve existing records.
4. Admin reviews source, skills, geography, seniority, device suitability, and dates. A live job without a deadline needs explicit editorial confirmation that the source provides none.
5. Only published content appears in the catalogue and recommendations. Missing feed entries never automatically mean a job has closed. Automatic imports run every six hours while the catalogue service is running, with a persistent admin pause switch. Source freshness checks and read-time deadline expiry are implemented; see FUNCTIONALITY_RELEASE.md for conservative closure rules.

## Learner logic

GET `/recommendations` composes learner state, latest CV review, and published catalogue through service REST calls. When OpenAI is configured, it can select and explain only the records already selected by deterministic goal matching; valid catalogue IDs outside that shortlist are rejected. The response preserves the learner's exact goal and places deterministic fit/evidence explanations before AI prose. When OpenAI is unavailable, rule-based recommendations remain goal-aware: the inferred or selected track orders target-skill gaps, then ranking uses background/CV mentions, recorded practice, country, device, time and low-data preferences. Unsupported aspirations and sparse catalogues still limit match quality; irrelevant catalogue items must not be used to fill a recommendation quota.

Resource ordering favours target skills absent from learner background/CV mentions and device compatibility. Video/data conflicts and computer requirements are shown. Opportunity ordering uses target-skill overlap and declared skill mentions. Country restrictions and expired known deadlines filter results. Global listings retain eligibility uncertainty and seniority warnings. Scores are ordering heuristics, not hiring probabilities; CV mentions are not verified proficiency. Original source links remain visible.

Pathways provide four introductory weeks with observable tasks and time limits. Phone coding tracks prepare sketches/pseudocode and explicitly require computer access for implementation. Four weeks is a project sprint, not complete career readiness. Existing saved pathways are preserved until a learner changes their plan. OpenAI drives personalised guidance when configured; explicitly labelled basic matching and curated-resource templates remain available when it is unconfigured or fails.

## Current limits

No automated applications, employer verification, scholarship API, complete regional job coverage, verified skill assessments, or automatic multi-sprint progression. CV uploads use local explainable text checks. Original files and previews are excluded from model input; derived skill mentions may inform AI guidance. Source credentials for additional providers must be configured before connecting them.

Validation: 50 backend tests and production frontend build, including location restrictions, source URL validation, draft isolation, publication, import cooldown, goal-specific templates, CV uncertainty and composed recommendations.


## Simple navigation and automatic loading

Learner routes: `/app` (Today), `/app/discover` (combined opportunities/resources), `/app/progress`, `/app/settings`, `/app/match?opportunity=ID`, and `/cv`. Admin routes: `/admin`, `/admin/resources`, `/admin/opportunities`, `/admin/learners`, `/admin/audit`, `/admin/sources`. Sections support direct navigation, refresh and browser back/forward.

Today shows one current task with one learning resource and check-in controls. Discover shows matched opportunities beside learning resources; explanations and the full catalogue are expandable. Recommendations now use recorded completed practice as an ordering signal, explicitly not verified mastery.

The catalogue service owns an automatic import loop. `AUTO_INGEST=true` is the default; `SOURCE_REFRESH_HOURS=6` controls the interval (minimum one hour). `GET/PUT /admin/source-settings` provides the persisted enable/pause switch. A one-minute wake-up checks which sources are due; no additional service or queue is required. Imports remain drafts and preserve existing editorial decisions. The read-only admin demo cannot change this setting. The service must remain running for automatic checks; new content availability depends on upstream feeds and editorial publication.

## OpenAI guidance

Discovery and fit explanations now use structured OpenAI responses, with server-side validation of catalogue IDs, effort limits and generated links. Model recommendations are rehydrated with canonical source records. Valid responses are cached for fifteen minutes by input; failures briefly back off and display labelled basic guidance. See [setup and boundaries](OPENAI_GUIDANCE.md).

Current source freshness, saved tracking and onboarding behaviour: [release notes](../archive/FUNCTIONALITY_RELEASE.md).
