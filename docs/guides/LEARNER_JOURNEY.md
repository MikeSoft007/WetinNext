# A working learning journey

Updated 2026-10-12.

## Less-data resources

The preference prioritises text-first guides and exercises over video-heavy courses. It does not compress external websites, measure bandwidth, promise offline access, or guarantee megabytes per lesson. Text pages may contain images; full PDFs and interactive editors may still be large.

Every published resource now has derived, inspectable metadata: `data_usage` (text_first/video_heavy/mixed/unknown), `low_data_suitable`, `data_note`, introductory practice outcomes, an original sample exercise, suggested starting-session length and prerequisite/access guidance. These are WetinNext study aids, not provider-verified course completion requirements. Unknown media is not labelled low-data. Interactive courses alone are not assumed lightweight.

The preference affects deterministic ranking and OpenAI candidate selection, with an all-resources fallback when no text option is available. Discovery offers an explicit text-first filter (`GET /api/v1/search?kind=resources&low_data_only=true`). Marketing starter sprints select the published OpenStax text alternative when low-data is requested. Existing completed tasks remain intact when availability changes. Some specialised starter sources still include mixed media and are labelled accordingly.

## From goal to evidence

1. Goal setup collects direction and core constraints in two steps. A compact editable goal recap replaces a separate review step; track and recommendation preferences remain optional. The saving state uses an original animated path, book and milestone illustration, with reduced-motion support. No fake completion percentage or artificial delay is used.
2. Today leads with the current week's task rather than discovery research. A learner without a plan gets one clear path into goal setup or plan research. The weekly workspace retains its three actions: learn one idea, practise the task, and check/save evidence. Action ticks persist through `GET/PUT /api/v1/weeks/{week}/work`.
3. Learners can explicitly save a project HTTPS link and a private reflection. Evidence saving is separate from unsaved drafts; ticking an action does not silently submit a draft reflection. Checkbox completion does not automatically mark a week complete.
4. Check-ins remain sequential and self-reported, and are available beside the current task. Learners can report completion, difficulty, or a need for more time; they can also adjust their weekly pace or choose another learning resource without changing tabs. Difficulty/time feedback references the selected week's title and success criteria. The final week points to portfolio and CV review rather than announcing a nonexistent fifth week.
5. Progress shows saved evidence in a current-sprint portfolio (`GET /api/v1/me/portfolio`), week completion and the existing application/history tracker. A new sprint receives a unique ID; availability changes preserve its evidence. Existing pre-ID plans use a stable fallback identity.
6. CV reviews now suggest up to two published learning resources for missing tracked requirements or goal skills. Suggestions respect the saved lower-data preference. CV text checks remain deterministic; derived skills feed discovery and fit guidance. Resource recommendations do not establish proficiency.
7. Discovery connects the saved goal, CV signals and recorded practice to published opportunities, requirements and gap resources. Market and source-availability rules remain enforced. Preparation checklists and application stages retain the existing learner-owned persistence.

Private weekly reflections, project links, raw CV documents and extracted previews are excluded from AI requests. Work endpoints enforce learner ownership. URLs accept HTTPS only, without embedded credentials, and are never fetched by the server. Account deletion also erases weekly work. Evidence is self-reported, not independently verified.

## Failure behaviour and remaining limits

- AI failure returns a labelled starter plan or rule-based recommendation set. It does not prevent check-ins, evidence saving, CV text review, browsing or tracking.
- A sprint needs published free resources. Empty/unavailable catalogues produce an explicit recoverable error, rather than saving a plan with fabricated links. Missing template sources are replaced with a published free alternative; specialised relevance still needs editorial oversight.
- The current live OpenAI test returned HTTP 429; the provider message points to quota/billing. Key configuration is loaded, but successful AI generation is not confirmed. Consult [OpenAI error guidance](https://developers.openai.com/api/docs/guides/error-codes) and the account's API credits/project limits. No billing changes were made.
- Resources stay on their original providers' websites. WetinNext supplies guidance and practice aids, not a copied course library or automatic verification of completed work.
- The learner interface remains English-only. Do not present a language selector as supported until translated interface content and appropriately localized learning sources are available.
- Latest visual browser verification remains blocked by the earlier browser URL-policy rejection. Component tests exercise interactions in an isolated DOM; they do not establish screenshot/layout correctness.

## Verification

Backend: `cd backend && .venv/bin/python -m pytest tests -q`.
Frontend interactions: `npm --prefix web test`.
Production build: `npm --prefix web run build`.

The gateway journey test covers profile → sprint → evidence → adjustment → four check-ins → discovery → CV review → application tracking → account erasure, including cross-account ownership, invalid links and action validation. UI tests cover the three-step goal form, busy animation, successful CV upload, recoverable extraction errors and explicit evidence saving. All test learner/CV data is synthetic; persistent user workspaces are not altered.

## Goal bundle retrieval (2026-10-13)

Discovery now retrieves up to 12 subject-relevant learning records and 20 opportunities before AI selection, rather than limiting the model to the two resources/four jobs displayed by the rule-based recommender. Low-data selection follows domain retrieval. Transferable-skill-only courses no longer fill domain career bundles. A job whose recognised career title conflicts with the target track is excluded.

For automatic goals outside known tracks, a bounded structured OpenAI intent step extracts domain skills before retrieval. It has an eight-second deadline within the gateway request budget and shares the model cooldown/cache controls. If interpretation or catalogue coverage is absent, unrelated foundation resources are not substituted. This is bounded taxonomy/skill retrieval, not general web search; unrecognised terminology can still reduce recall.

AI output now includes `bundle` (focus, weekly deliverable, rationale, original goal) and AI priority skills, plus `coverage` (relevant candidate counts and selected market). Learner UI displays that focus and links opportunity preparation directly to learning resources. Fallback is explicitly labelled and does not invent the AI bundle. Existing source IDs, country/closure/deadline validation, and honest eligibility constraints remain in force.

Remaining coverage gap: interpretation does not create verified courses or vacancies. Expanding authorised feeds and curated domain catalogues is necessary for broad career support. Global remains a separate market. Saved historical sprints are not silently regenerated by discovery changes.
