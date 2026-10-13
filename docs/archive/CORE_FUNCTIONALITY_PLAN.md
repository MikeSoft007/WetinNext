# WetinNext: core functionality and integration plan

Review date: October 11, 2026. This document recommends the next implementation; proposed features below are not described as already shipped.

## Product promise

Bring relevant, currently available opportunities together with the learning and evidence a person needs to pursue them. The learner should leave with a next action, not another long list of search results.

## Current verified state

Automatic imports are enabled every six hours while the catalogue service runs. Jobicy and freeCodeCamp are connected. The local catalogue currently contains 15 job drafts and 7 resource drafts; learner-facing opportunities are two synthetic practice listings. Four curated learning resources are published. Importing and publishing are separate, so automatic imports do not yet produce a continuously refreshed live learner job feed.

Discover combines career goals, CV skill mentions and self-reported completed practice. Detailed opportunity assessment uses separate logic and does not compose CV reviews. This inconsistency is a central improvement target.

## Recommended integration strategy

Use official APIs first, permitted RSS/Atom feeds second, and reviewed source links as a fallback. Import metadata and short summaries with canonical links into the existing catalogue. Serve recommendations from that local catalogue; do not query all providers for every learner visit. Keep current REST boundaries and one refresh loop; add no new microservices, queue or vector database for this stage.

### Initial sources

1. Jobicy: keep for remote jobs. Complete sequential cursor pagination. Add its batch status endpoint and preserve attribution/canonical URLs. A feed disappearing after seven days does not imply closure. Status reflects Jobicy's records, not a direct employer check. Documentation: https://github.com/Jobicy/remote-jobs-api
2. A small registry of relevant employers using Greenhouse or Lever: add an employer once, then automatically fetch its published jobs. These are per-employer APIs, not a worldwide employer directory. Select companies with Nigeria/Rwanda or explicitly eligible remote roles, and confirm appropriate reuse before enabling each board. Greenhouse public GET endpoints need no authentication. Sources: https://docs.greenhouse.io/job-board.html and https://github.com/lever/postings-api
3. freeCodeCamp: keep metadata ingestion, but treat the GraphQL API as alpha. Retain cached metadata and reviewed fallback links if it changes. Source: https://curriculum-db.freecodecamp.org/
4. MDN/Python: retain curated learning links, organised by skill and prerequisite. Bulk crawling is unnecessary.
5. Microsoft Learn: add when its onboarding/authentication is configured. Source: https://learn.microsoft.com/en-us/training/support/integrations-learn-platform-api-catalog
6. ReliefWeb: useful expansion for humanitarian jobs/training once a pre-approved appname is obtained. Source content rights remain with original providers. Source: https://apidoc.reliefweb.int/

Do not assume one feed covers the Nigerian or Rwandan job market. Expanding the employer/source registry is a more focused first step than indiscriminate scraping. Scholarships need their own verified source coverage and eligibility fields; they are not supplied by the current job integration.

## Priority 1: job lifecycle and fresh content

Separate editorial status (draft/published/archived) from availability (open/closed/unknown) and eligibility (supported/unclear/restricted). Add posted_at, source_updated_at, last_seen_at, last_checked_at, deadline and canonical_url. Keep upstream facts separately from editorial overrides so updates do not overwrite approved guidance.

On each due run:

1. Fetch all configured pages within provider rules and a bounded run budget. Record incomplete traversals.
2. Validate identifiers, URLs and schema; normalise fields and resolve duplicate source IDs/canonical links.
3. Insert new records; refresh source-owned fields on known records. Deduplicate cross-source copies using canonical application URL or employer/title/location as a review signal.
4. Check stored job availability using provider status endpoints where possible. Hide confirmed closed and deadline-expired roles across catalogue, matching and application actions. Keep unknown distinct; failed requests never close jobs.
5. Record source health, counts and checks. Preserve cached records on upstream failure; show stale/unknown status rather than presenting unverified jobs as open.

Jobicy: batch at most100 source IDs per documented status request. Respect Retry-After and provider limits. A recent HTTP200 from a generic careers page alone is not evidence that a particular job is open. Only infer removal from an employer board after a successful, complete fetch and source-specific confirmation policy.

## Priority 2: publication without a permanent manual bottleneck

Approve providers and publication rules once. Allow automatic publication only for configured sources with suitable reuse terms and listings that pass required source, availability, location and content checks. Send ambiguous geography, seniority, missing information and suspicious changes to an exception queue. Keep the ability to pause a source or override a record. This is proposed: current code sends every import to draft.

Separate public source availability from personal eligibility. “Remote” never automatically means Nigeria/Rwanda eligible. Where no suitable job is available, show a truthful empty state and the next learning action, not an unrelated senior role or a practice listing represented as live.

## Priority 3: one learner evidence model and one matching result

Use the same skill identifiers and evidence states for CV review, recommendations, detailed fit and pathway creation. Keep CV mentions, learner-reported practice and reviewed project evidence distinct. Expose extracted skills for learner correction; keyword absence is not proof of inability. CV upload remains optional.

First apply eligibility/location/availability filters. Then rank by goal fit, experience level, skill evidence, learning effort and deadline feasibility. Do not let raw skill overlap put senior roles ahead of beginner opportunities without clear explanation. Avoid artificial hiring percentages.

For each opportunity return a small result:

- Why it is relevant.
- Evidence already mentioned or recorded.
- The most useful missing/uncertain requirement.
- One free resource that addresses that requirement, with prerequisite, device and data requirements.
- One concrete project/application action.

Resources should map to the selected opportunity's gaps, not only the general career track. Missing time/level data should be marked unknown rather than generated as fact. Use AI optionally for structured extraction and concise explanations; feed it only catalogue records and retain source provenance. It must not invent URLs, deadlines or eligibility facts.

## Simple learner flow

1. Choose a goal, country and weekly availability; optionally upload a CV.
2. Confirm the inferred starting track and extracted skills. Unknown professions require clarification rather than silently defaulting to data.
3. Open Discover: a small set of relevant open opportunities with their connected learning resources.
4. Select a role: inspect fit and one concrete next action. Save it if useful.
5. Today shows one task and resource. Check in or attach a project link.
6. Recompute recommendations when the CV, goal, evidence or job availability changes.
7. Apply on the original employer/provider website; mark the application status in WetinNext.
8. On sprint completion, review evidence and explicitly choose a next sprint while preserving history. Four weeks is a working interval, not a career-readiness guarantee.

## Simple admin flow

Sources shows automatic refresh, last success and source health. A single “Needs review” queue collects exceptions. Admins approve sources/rules, resolve uncertain records and inspect basic activity. An empty queue should require no routine intervention. Keep demo admin read-only and learner activity fictional there.

## Operating model

Six-hour job discovery/availability checks and less frequent learning metadata refreshes are reasonable initial proposed defaults, subject to each provider's rules. A deployment must keep the catalogue service running; a laptop that is shut down cannot refresh sources. For a small hosted deployment, one always-on catalogue worker is sufficient. Use a managed scheduled job only if the host does not support an always-on process. Keep persisted due times, locks, retries and source health within the existing catalogue service.

## Acceptance criteria

- A permitted new source record appears without an admin pressing Import.
- Approved-source records passing publication rules become learner-visible; exceptions remain reviewable.
- Repeated syncs update records without duplicates or losing editorial overrides.
- Confirmed closed roles disappear from normal discovery and cannot be treated as active applications.
- Source failures preserve data but do not falsely claim recently verified availability.
- A learner sees the same skill evidence and uncertainties in Discover, CV review and detailed fit.
- A missing requirement leads to an appropriate resource and task that respects time/device constraints.
- A learner can follow the main journey without repeatedly searching external sites.

## Recommended implementation order

1. Jobicy pagination, update semantics and availability checks.
2. Controlled automatic publication and a small employer feed registry.
3. Shared evidence/matching logic and opportunity-linked resource suggestions.
4. Source health, feedback on suggestions and next-sprint continuation.

Measure useful matches saved, broken/closed listing rate, exception-queue size, completed actions and learner feedback. Raw imported-record counts alone do not establish product usefulness.
