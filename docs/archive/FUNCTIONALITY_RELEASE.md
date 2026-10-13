# Discovery and tracking release

Implemented October 11, 2026. The application canvas is standard white (#FFFFFF).

## Source freshness

Jobicy, Remotive and freeCodeCamp run through the catalogue scheduler. New content remains a draft. Existing records retain publication state and edited copy; refreshed upstream metadata is saved as a reviewable `source_snapshot`. Changed upstream country restrictions take effect immediately. Admin record editing shows latest source facts and check dates.

Remotive uses its complete public active-job feed, with bounded responses, strict schema/count checks and a six-hour minimum attempt interval (at most four daily attempts). Jobs missing from two successful complete feeds become `closed`, with the explanation “Removed from two complete source feeds”. An empty, malformed or unavailable feed never closes existing jobs. Reappearing listings can become listed again while preserving editorial publication state. Feed availability does not establish employer eligibility or a guarantee that applications remain open. The provider delays public results by 24 hours.

Jobicy supplies a partial feed: absence never establishes closure. Up to 20 oldest due Jobicy canonical URLs are checked with HEAD on a refresh. Only HTTP 404/410 mark a source listing removed; 200 means page reachable, not confirmed open. Redirects, 403/429, network failures and other inconclusive responses do not close a listing. Checks use fixed provider hosts, no redirects, timeouts and six-hour due windows. Large catalogues are checked across cycles.

Known deadline expiry closes a listing at read time, including when imports are paused. Closed records are omitted from normal discovery but remain retrievable for saved history. `last_checked_at`, `source_seen_at`, `availability` and `last_check_result` are returned with opportunities. Lists can include closed published records using the catalogue service’s `include_closed=true` option.

## Broader coverage

Remotive is a second working job integration. `/opportunities` provides public source links and attribution without signup. Nigeria, Rwanda and explicitly worldwide locations are supported; country restrictions remain uncertain personal eligibility. Restricted locations are not promoted as worldwide. Four added free resource entries cover OpenLearn digital literacy, IBM SkillsBuild, Git and SQL. Mixed-media/account/device requirements are explicit. These are curated provider resources; they are not additional automated learning APIs. Basic sprint templates still cover data, frontend and backend.

Official source references:
- https://github.com/remotive-com/remote-jobs-api
- https://skillsbuild.org/adult-learners
- https://www.open.edu/openlearn/digital-computing/digital-skills-succeeding-digital-world/content-section-overview
- https://git-scm.com/book/en/v2
- https://www.postgresql.org/docs/current/tutorial.html

## Saved preparation and applications

Learner-owned `opportunity_progress` stores checklists keyed by actual action text, notes, application stage history and an opportunity snapshot. Reworded model actions do not inherit old ticks. Ticks are self-reported preparation, not reviewed skill evidence. Application status changes do not submit an application or contact employers. Practice examples cannot receive real application stages. New applied stages are blocked for known closed listings. Existing application history and notes remain editable after closure or archival. Private journal notes and checklists are excluded from model input.

REST endpoints (all prefixed `/api/v1`):
- `GET /applications`: current learner’s saved tracker and current published availability.
- `PUT /applications/{id}`: stage plus optional notes, bounded history of 50 changes.
- `GET /preparation/{id}`: saved checklist and journal.
- `PUT /preparation/{id}`: `{ "action": "...", "completed": true }`, up to 30 actions per opportunity.

Stages: interested, preparing, applied, interviewing, offer, rejected, closed, withdrawn. Journals are isolated by backend learner identity and removed with account deletion. Tables are created additively by the existing service startup; formal database migrations remain deployment work.

## Onboarding and verification

Onboarding uses two steps: goal/profile, then availability/background. It validates required fields, trims server-side text, shows the goal before submission, retains entered values when moving back, contains keyboard focus, supports Escape and disables dismissal during saving. No default aspiration is silently selected. CV upload remains optional and can be completed later.

50 backend tests pass, including an integration journey across gateway, learner, catalogue and matching services: CV upload → goal → constrained plan → discovery → fit → saved preparation → check-in → updated guidance. Tests also verify ownership, account deletion, publication preservation, complete/partial feed semantics, source errors, expiry and application safeguards. Service HTTP is substituted in automated tests; running-service browser checks verify local wiring and refresh persistence. Live OpenAI behaviour remains unverified pending credentials.
