# OpenAI guidance

WetinNext uses OpenAI to interpret a learner’s aspiration and connect published learning resources, opportunity requirements and practical next actions. Public source integrations supply catalogue facts; the model selects and explains those records.

## Run locally

1. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `backend/.env`. Choose a model available to your account that supports Responses structured outputs. Keep credentials on the server; never use a frontend `VITE_` variable for the key.
2. Restart the backend with `python3 scripts/dev.py` from the project root.
3. Set a learner goal, then open `/app/discover`. A validated model response displays **Personalized with AI**. Missing configuration or a failed request displays goal-based guidance with its reason; HTTP 429, 401 and 403 responses are identified without exposing provider response details.

Configuration status alone does not prove a model request succeeded. No live OpenAI request was verified during this implementation because local credentials and a model were not configured.

## REST flow

- `GET /api/v1/recommendations`: combines the learner profile, latest CV skill mentions, recorded practice and published catalogue. AI can choose only from deterministic goal-ranked matches; server-side validation rejects valid catalogue IDs that are outside that shortlist. Responses preserve the learner's exact goal and include deterministic fit/evidence reasons alongside AI guidance.
- `GET /api/v1/opportunities/{id}/assessment`: explains evidence signals and uncertainties for an opportunity, with preparation steps and relevant learning resources.
- `PUT /api/v1/me/profile`: initial pathway generation uses the aspiration and constraints, plus available derived CV skills. Existing plans are preserved according to the plan update flow.

CV/progress/catalogue changes affect subsequent guidance requests and invalidate the input-based cache. Discovery does not silently overwrite a saved pathway.

## Reliability and privacy

Structured responses select offered IDs. The server validates references, duplicate choices, effort against weekly availability and links introduced in narrative text, then attaches canonical source objects. Unknown IDs or invalid output trigger basic matching. Source facts and availability are not established by model confidence.

Model input includes goal, background, country, device, available time, derived skill mentions and bounded recorded tasks/status. It excludes learner names, original CV files, saved CV text previews and reflection notes. Requests use `store=False`. Successful responses are cached in process for fifteen minutes; provider failures have a short backoff. Concurrent model work is bounded. Recommendation endpoints use `Cache-Control: no-store` for browser/proxy responses.

## Practical boundaries

- The model sees up to 40 eligible opportunities and 30 free-labelled resources from the published catalogue. Coverage depends on source integrations and editorial publication.
- Public imports run automatically but arrive as drafts. Existing listings now use conservative source removal checks; see FUNCTIONALITY_RELEASE.md. Known expired deadlines and closed statuses are excluded; a missing deadline does not establish that a vacancy is still open.
- CV extraction and initial skill checks remain local keyword-based checks. Mentions and recorded completion are evidence signals, not verified proficiency.
- AI selection cannot widen the deterministic goal-ranked shortlist. If no relevant published record is available, the system must not turn unrelated catalogue entries into a match.
- Rule-based discovery uses the declared goal, ordered target-skill gaps, background/CV skill mentions, recorded practice, country, device and low-data preference to rank and explain catalogue matches. It does not use a language model; unsupported aspirations and sparse catalogues still limit match quality.
- Four weeks is a practical learning sprint, not a promise of career readiness or employment. Applications remain under the learner’s control.

## Verification

50 backend tests pass, including mocked structured responses, canonical references, invalid-output fallback, caching, privacy exclusions and eligibility filtering. Frontend production build is checked separately. Mock tests do not establish live provider availability or recommendation quality; evaluate real responses after configuring credentials.
