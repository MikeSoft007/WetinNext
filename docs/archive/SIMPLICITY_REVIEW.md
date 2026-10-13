# WetinNext product and code review

Reviewed October 11, 2026. Scope: landing/authentication, learner onboarding and navigation, pathway generation and adjustment, CV upload/review, recommendation and assessment logic, catalogue/source ingestion, admin access, REST boundaries and tests. This is a source-code and local behaviour review, not a production penetration test or a usability study with learners.

## Direction

Keep one clear promise: choose a goal, know this week's task, build evidence, then assess a relevant opportunity. Keep the current React/FastAPI implementation and existing service boundaries. No additional services, queues or vector database are needed for the current catalogue and three tracks.

## Improvements made during this review

- Sign-in now offers “Explore admin demo”, also reachable at `/admin-demo`. It opens a signed, one-hour, read-only role. Server checks reject all administrative writes; buttons for imports, additions and saves are disabled. The endpoint is unavailable with DEMO_MODE=false. Learner activity is fictional; published and draft catalogue content remains the actual local catalogue. No real administrator password is shown or required. Learner navigation remains free of admin links.
- Pending coding weeks retain their coding resources when device/time preferences change. Phone preparation is explicit and reversible; completed weeks remain untouched. Previously all pending weeks were assigned spreadsheet resources. Evidence: learners/api/v1/routes.py, test_device_adjustment_preserves_coding_track.
- Phone pathways use reviewable preparation templates. Previously the AI's phone resource allowlist contained only the spreadsheet guide, even for coding goals. The fallback message now says introductory project template rather than spreadsheet template. Evidence: learners/pathways.py.
- Phone compatibility recognises the existing “phone or laptop” resource label. Previously it falsely reported that guide as needing computer access. Evidence: matching/recommendations.py, test_phone_compatible_resource_label.
- Onboarding makes the three supported starting tracks selectable. Resource discovery shows at most two resources, reducing choice overload.

## Recommended next changes, in order

| Priority | Finding in current code | Smallest useful improvement | Expected outcome |
| --- | --- | --- | --- |
| 1 | The dashboard repeats the current task across the sprint card and full timeline, followed by discovery and an assessment. | Make “This week” the first card with one task, one resource and one check-in button. Keep the timeline collapsed until requested. | A new learner can identify their next action immediately. |
| 2 | Unknown career goals default to data, and track coverage is limited to three templates. | State the inferred track before creating the plan; if the goal is outside coverage, ask the learner to select a supported starting track. | Fewer irrelevant plans; no implied support for every profession. |
| 3 | Imports are insert-only, with manual sync. Listings can become stale; known expired dates are filtered in recommendations but still appear in the general catalogue. | Add a “last checked” label, hide expired items in normal discovery, and offer an admin review-needed filter. Add one periodic refresh only when deploying. | Learners waste less time on unavailable opportunities. |
| 4 | CV checks return a long action list using keyword/heading detection. | Show the top three actions, with the rest under “More suggestions”; link one action to the current project task. | CV feedback becomes something learners can act on this week. |
| 5 | Recommendations use a small taxonomy and CV mentions; detailed opportunity assessment uses separate evidence logic. | Share the skill taxonomy across both views and label evidence consistently as “mentioned”, “learner-reported project”, or “needs evidence”. | Less confusing skill-gap feedback without adding scoring complexity. |
| 6 | Admin edits expose generic fields, including device labels and sample status. | Use plain labels, controlled device options and a short publish checklist: source, eligibility, dates, skills. | Faster curation and fewer inconsistent records. |
| 7 | Supabase access tokens are stored in sessionStorage; no refresh lifecycle is implemented. | Add session refresh and clear sign-in-again handling before production accounts are enabled. | Learners do not lose their place when authentication expires. |
| 8 | Plans are a single four-week sprint; there is no next-sprint workflow. | Add a completion screen: review evidence, choose a next goal, explicitly create another sprint while preserving history. | Continued progress without promising career readiness in four weeks. |

## Keep simple

Keep the existing navigation for now; test the above changes with a few learners before removing or adding tabs. Keep admin functions together in one workspace. Use original source links and editable curated tags. Use transparent rule-based matching until the catalogue and real learner feedback show a need for more sophisticated retrieval. Keep the admin demo read-only; use a real administrator account for content changes.

## Verification

28 backend tests pass, including demo read/write boundaries, fictional activity isolation, production demo disablement, device adjustment and phone compatibility. Frontend TypeScript and production build pass. Local browser checks cover preview entry, sample activity, source browsing and disabled import controls. Production Supabase integration, large-scale concurrent writes and live learner usability testing were not verified in this review.
