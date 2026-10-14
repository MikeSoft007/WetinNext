# Presentation journey rehearsal

Live API and model rehearsal; no browser visual verification. Fresh isolated learner, synthetic CV and self-reported practice only. Existing learners unchanged.

| Step | Status | Detail |
|---|---|---|
| Fresh isolated learner | PASS |  |
| Create new goal | PASS |  |
| Research phase | RUNNING | Searching official learning and local training sources |
| Research phase | RUNNING | Connecting sources to a four-week beginner plan |
| Research phase | RUNNING | Your guide is ready |
| Live web/model guide | PASS | 4 free sources, 4 paid options, 5 training places, 1 confirmed openings |
| Adopt researched plan | PASS |  |
| Save practice evidence | PASS |  |
| Complete week one | PASS |  |
| Generate/submit live quiz | PASS | Rehearsal answers only; not a proficiency claim |
| CV goal comparison | PASS | 1 mentioned target skills; 3 gaps |
| Journey log | PASS | 3 recorded events |
| Reconnect restores profile/plan/progress | PASS |  |

## Issue found and corrected

The live journey initially showed three entries after work, check-in, quiz and CV review. The journal checked a `completed` property, while quiz completion is persisted as `result`. Fixed the journal to use the saved result and added a storage-level regression. The live model steps were not rerun after this journal-only fix.

## Presentation sequence

1. Sign in and open Discover.
2. Enter “Learn DevOps and prepare for junior cloud roles” in the goal prompt. Confirm Kigali/Rwanda, beginner background and four hours per week.
3. Show real research phases and the sourced guide. Free resources, paid comparisons, training routes and confirmed openings are separate.
4. Adopt the four-week plan, open Progress, review week one and save a note/practice example.
5. Complete the week and start a four-question beginner practice check. Show selected/correct answers and linked lessons after submission.
6. Upload a synthetic CV in Review; explain matched skill mentions and missing evidence.
7. Revisit the Journey log and refresh to show saved profile, goal, plan and progress.

This rehearsal used a fresh isolated demo-session identity, not the account already open in the browser. The presenter must run this flow in their own signed-in demo account to show it on screen.

Read-only re-evaluation of the persisted rehearsal data after the journal fix returned **four events**, including the completed practice check. Existing learner data was not edited.
