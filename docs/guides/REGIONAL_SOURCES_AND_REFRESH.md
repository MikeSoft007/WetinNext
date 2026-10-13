# Regional sources and publication refresh

Updated 2026-10-12.

## Changed source requirements

Automatic imports now refresh canonical titles, skills, descriptions, requirements, organisations, seniority, locations, links and deadlines from the source. Meaningful changes record `source_changed_at`, `source_changed_fields` and a `refresh:requirements` audit event.

Previously automatic published records are checked again inside the same refresh transaction. Ineligible geography, incomplete facts, expired deadlines or seniority requiring review return the record to draft with an `unpublish:source-change` audit event. This withdrawal works even when automatic publication is paused. When source facts become acceptable again, normal publication can resume if enabled. Existing learner journals/checklists are not deleted; learners should review their preparation after a requirements change.

Explicit manual edits, legacy editorial saves and archived records retain their copy and publication decision. Their latest source snapshot remains available to administrators. Geography/freshness updates still apply so editorial copy cannot override source location restrictions. Invalid upstream responses preserve existing records. Absence in a partial feed does not establish closure.

## Available integrations

| Source | Current integration | Important boundary |
| --- | --- | --- |
| Jobicy | Scheduled public job feed | Now requests all locations rather than only worldwide listings; bounded partial feed, not a complete local inventory |
| Remotive | Scheduled public remote-job feed | Attribution, public access and six-hour minimum refresh; worldwide does not prove individual eligibility |
| ReliefWeb | Nigeria/Rwanda-filtered jobs API adapter | Requires approved `RELIEFWEB_APPNAME`; not active without approval. Single-country records only. Partial feed cannot establish removal |
| HEC Rwanda | Bounded official announcement-page import, respecting robots.txt | Scholarship/study-loan PDFs become drafts. No inferred deadline, course subject or open-application status. No PDF auto-publication |
| freeCodeCamp | Allowlisted curriculum metadata import | Free course links; coding exercises need a computer |

ReliefWeb setup: obtain an approved application name using [official instructions](https://apidoc.reliefweb.int/parameters), set `RELIEFWEB_APPNAME` in `backend/.env`, restart the backend, then use Admin → Sources → Check now or allow the scheduler to run. Missing configuration appears in the source card and returns HTTP 409 for manual sync.

HEC imports only title and canonical PDF links from the official scholarship listing; the announcement may be expired. Administrators must read the original notice before publishing. A missing page/parser failure preserves existing records. No automated PDF download/extraction is included.

## Local discovery

`GET /api/v1/regional-sources?country=Nigeria|Rwanda` returns maintained portal links, separate from job records and personalised fit scores. Discover follows the selected market and labels these as directories:

- Nigeria: [Federal scholarship portal](https://scholarship.education.gov.ng/) and [3MTT](https://3mtt.nitda.gov.ng/).
- Rwanda: [HEC scholarships](https://www.hec.gov.rw/updates/scholarships), [Kora jobs](https://jobportal.kora.rw/) and [professional internships](https://www.internship.rw/).

These are verified official entry points, not promises that an application window is currently open. Some require registration. Directory URLs were source-checked on 2026-10-12; they need periodic editorial review.

## Career pathways and resources

The original data/frontend/backend templates are joined by cybersecurity, digital marketing, customer support, project coordination and scholarship preparation. Unknown goals use a digital/career exploration sprint rather than silently becoming data analysis. Each new preparation sprint works with a phone, stays within the weekly time budget and produces a saved draft/checklist. No career-readiness guarantee is made.

Added source-backed learning entries cover IBM SkillsBuild, HubSpot Academy, OpenLearn project management, Microsoft Learn data analytics, Harvard CS50 Python, MIT OpenCourseWare Python and OpenStax marketing. They explicitly distinguish reading from computer practice, videos from text, account requirements and optional paid products/certificates. Catalogue entries are curated links; the existence of a free provider does not imply a bulk metadata API.

## Further expansion options

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html): public GET endpoints; add approved employer board identifiers and exact location filtering. Not a global job-search API. Adapter not implemented yet.
- [Lever Postings API](https://github.com/lever/postings-api): employer-specific public postings; needs a maintained employer allowlist and eligibility checks. Adapter not implemented yet.
- [Microsoft Learn Platform API](https://learn.microsoft.com/en-us/training/support/integrations-learn-platform-api-catalog): authenticated application onboarding is required before bulk integration. Existing Microsoft Learn links are curated; no bulk sync implemented.
- [OpenStax](https://openstax.org/higher-education), [MIT OpenCourseWare](https://ocw.mit.edu/search/), [Harvard CS50](https://cs50.harvard.edu/python/): expand reviewed course/chapter links with prerequisites and access costs; do not assume free certification or reproduce course content.

Prefer documented feeds and employer APIs. Use official portals when no permitted feed exists, and keep unverified announcements separate from confirmed listings. Broader regional coverage still needs maintained employer partnerships/allowlists and eligibility review.

Microsoft's older `/api/catalog` endpoint is planned for deprecation (the documented continuation period ended June 2026). Use the replacement Learn Platform API documentation rather than building a new adapter against the old endpoint.


## Verification on 2026-10-12

- Full backend suite: 66 passed (one existing Starlette/httpx deprecation warning).
- Frontend TypeScript/production build: passed; browser console showed no errors in the landing preview.
- Live local gateway: 23 published learning resources and five regional portal entries returned HTTP 200.
- HEC public import: 10 real notices imported as drafts. No confirmed scholarship opening or deadline was inferred.
- Browser checks: market switch changed Nigeria/Rwanda portal cards; landing and auth styles verified; 390px mobile had no horizontal overflow; 3840px hero occupied 92% of the page and headline fit two lines.
- ReliefWeb live requests remain unverified until an approved application name is supplied. Greenhouse, Lever and Microsoft Platform API adapters remain future work.
