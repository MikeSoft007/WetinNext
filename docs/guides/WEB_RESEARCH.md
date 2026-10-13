# Live goal research

WetinNext now researches beyond the admin catalogue. Today and Discover offer a primary learning-guide studio: goal context, optional city, education and budget, live research stages, sourced learning, local institutions/current leads, and an adoptable four-week plan.

## REST flow

- `POST /api/v1/research` with `city`, `market`, optional `education` and `budget` returns a private job id immediately. It uses the authenticated learner's saved goal and constraints.
- `GET /api/v1/research/{id}` returns queued/running/complete/failed, an actual stage, and the guide when ready. Poll every two seconds while running; do not keep polling a terminal status.
- `POST /api/v1/me/research-plan` with `research_id` fetches the owner-scoped result through the matching REST API, checks that goal/time still match, saves its sourced resources with the new sprint, and starts its weekly checklist.

Three bounded OpenAI Responses web searches separately investigate free learning, institutions/regulation and current opportunities. A structured synthesis call builds the guide. URLs must occur in actual web-search sources/citations. This validates attribution, not the truth of every model interpretation. Tuition-based degrees are excluded from free-resource cards; openings require an explicit current-open classification and evidence, and past deadlines are removed. Nursing/midwifery beginner weeks are restricted to education-route research, anatomy theory, ethics/safety concepts and a training shortlist. No clinical qualification is implied.

## Privacy, failure and limits

- Only goal, country/city, time/device/data constraints and optional education/budget are sent to research. No names, raw CVs, extracted CV previews, private reflections or application notes.
- Jobs are private to identity, coalesced for the same input, limited to one active job per learner/eight globally, two executing pipelines, 100 cached jobs and 30-minute expiry. They are in-memory prototype state: a matching-service restart loses previews. Adopted plans/resources persist in the learner database.
- The original plan remains until explicit adoption. Adoption retains an archived plan/progress snapshot and old week evidence, but current portfolio is scoped to the new sprint; old evidence has no dedicated browsing UI yet. CVs/applications remain.
- Erasure attempts to cancel/delete matching research jobs as well as learner records. If matching is unreachable, ephemeral previews expire. A durable multi-worker queue/retention audit is still production work.
- Source presence does not verify accreditation, admissions, exact locations, eligibility or vacancy status. UI explicitly requests confirmation with providers; map links are external map searches, not verified coordinates or distance rankings.
- Live search incurs API/tool usage; provider failures show a retry message without fabricated results. No provider credentials or raw error bodies are logged. The configured OpenAI model must support Responses web search.
- No LinkedIn scraping or automatic public publication of research results. Researched leads are private previews.

## Verification

Backend tests cover source URL grounding, unsafe URL rejection, paid-program filtering, regulated beginner scope, privacy/ownership, idempotent jobs, plan adoption and linked weekly tasks, erasure, provider failures and the three-search synthesis. Frontend tests cover city → resources → schools/map → four-week adoption, plus empty-goal onboarding.

Live verification found generic programme pages incorrectly marked as current opportunities by the model. The server now requires explicit opening-language evidence plus a future deadline or a dated call from the last 90 days, otherwise removes it. It also avoids treating vague "Kigali area" location guesses as verified campus locations. For nursing/midwifery, free-learning sources are restricted after retrieval to primary OpenStax, Open University, WHO/OpenWHO, NextGenU and Khan Academy hosts. Displayed resource titles use source citation titles where available. This reduces, but cannot eliminate, model interpretation errors.

The configured gpt-4.1-mini supports web search but rejected API-level domain filters in live testing. Domain preferences are expressed in search instructions and enforced in post-retrieval nursing resource validation instead; no unsupported filters parameter is sent.

## Persistent guides and a shared goal (2026-10-13)

Completed research is now stored in matching-owned `research.db` until learner erasure. The 30-minute TTL only evicts the in-memory copy. GET `/me/research?market=Rwanda` restores the latest guide for the authenticated account's current goal and chosen market without a browser session id. Running jobs are persisted with educational context and can resume when the owner returns after a service restart. Adoption additionally stores the complete guide with the learner's plan. Research database files are excluded from Git and set to owner-only permissions.

Explicit fresh searches use `refresh: true`; ordinary repeated starts coalesce existing work. There is no longer an expiry error for a saved completed guide. Older unsaved previews that were already lost before persistent storage cannot be recreated from their browser id alone and need a new search.

Automatic goals outside supported starter tracks save the profile without generating an unrelated digital foundations sprint. Legacy unsupported starter sprints are marked `needs_goal_research` and hidden from Today/Progress, with stored work retained. PUT `/me/goal` archives an old sprint/progress and changes direction without deleting CVs or application records. Adopted research resources feed catalogue recommendation selection and CV preparation; CV selection defaults to the current goal and uses only goal-matched opportunities.

An original AI-generated learning illustration is bundled at `/images/learning-together.jpg` (about 128 KB), with its source under docs/assets. Text-first users choose whether to load it. It is labelled as illustration and never used as a purported photograph of an institution.

Saving or changing a goal in the web flow now starts research automatically in the chosen market. The asynchronous guide resumes in the shared research studio; it is not retriggered by ordinary refresh. Known-track starter work can remain available while research runs, whereas unsupported automatic goals wait for a researched plan. Clinical qualification caveats remain attached when availability changes.

Verification after persistence: 99 backend tests, 10 interface tests and production build pass. A live gateway check loaded a guide written to durable storage from a separate process, recovered it without a browser id, adopted it, and returned OpenStax/WHO recommendations in CV and live OpenAI discovery. Synthetic account data was removed after the check.

## Map frame and source layout

Schools & opportunities now includes an opt-in OpenStreetMap regional iframe, with attribution. It shows regional context rather than verified campus pins. Named institution links open external map searches for users to confirm each campus. No geocoding API/key, guessed institution coordinates or device geolocation is involved. The public Nominatim API is not used.

The sources disclosure spans the reading width, with numbered title/domain rows and a single-column mobile layout. Institution rows use consistent illustrated thumbnail tiles and aligned copy. These tiles are not photographs of the institutions.

## Assessment and simpler presentation

Maps now load automatically when the nearby-institutions section is displayed, following explicit market scope; Global uses a world extent, Nigeria its national extent, and Rwanda its regional/city view. Switching markets retrieves the corresponding guide and starts scoped research when none is saved. Sources are paginated six per page.

Progress includes a four-question AI practice check based on an adopted researched plan. Correct answers remain server-side until submission. Learner-owned attempts persist; submission is idempotent, historical attempts cannot be submitted against a changed sprint, and account erasure removes attempts. GET /me/readiness reports practice score, saved evidence and goal-specific CV review, with qualifications unverified and eligibility requiring opportunity-specific confirmation. This is not a validated examination, proficiency determination or hiring decision.

New research can include source-grounded external assessments/exam routes with free, paid, flexible or unknown cost type, purpose and prerequisites. Existing guides must be refreshed to find exam providers. Exam listings are distinct from free-learning resources, and booking/paying remains on the official provider website.

The primary UI uses concise summaries, fewer card borders and expandable qualification/assessment details. Inputs, active tabs and meaningful focus affordances remain visible.
