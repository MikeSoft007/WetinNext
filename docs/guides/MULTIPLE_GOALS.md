# Multiple goals

Learners can add a goal or resume one from the goal selector and History above the learner page heading. Each goal retains its profile, adopted plan, weekly progress and application associations. Research is already stored by owner, goal and market; CV reviews are selected by goal and week evidence and assessments by plan.

The existing learner row is the active workspace. A separate goal_workspaces table snapshots it before a switch. Normalized identical goal text resumes the existing workspace rather than creating a duplicate. Changes to the active workspace are saved before leaving it. Older goals are recovered where revision history retained their profile; missing historical data cannot be recovered.

## REST endpoints

All endpoints are authenticated and owner-scoped under /api/v1:

- GET /me/goals: goal history and active goal.
- POST /me/goals/{id}/activate: save current workspace and resume selected goal.
- PUT /me/goal: add a new goal or resume an existing normalized goal.
- GET /me/skills: current plan skills, planned weeks, self-reported practice and saved evidence counts.

## Skill tracking

Progress shows planned practice, logged weeks, evidence counts and the next planned week for each skill. These signals support learning reflection; they do not establish verified proficiency, professional licensure or employment eligibility.

## Verification

Regression coverage includes workspace restoration, isolated progress/history/evidence, repeated goal reuse, legacy profile recovery, owner isolation, deletion and goal-switcher/skill-tracker UI interactions. Full suite: 102 backend tests and 16 interface tests; production build passes. Browser visual verification remains pending.

## Account consistency

The saved learner name belongs to the account: adding or switching goals does not replace it. Goal creation reuses the learner’s saved preferences; only first-time profile setup asks for a name. A verified account’s name can initialise from its sign-up metadata.

Authenticated data is keyed to the verified account subject, including when local demo mode is enabled. Signing in as the same account restores the same learner and goals. The anonymous demo instead uses a seven-day browser cookie and cannot provide account recovery on another device.

Progress updates when the learner logs weekly check-ins, saves evidence or submits a practice check. It is not an inferred mastery score. Discover shows active-goal research rather than unrelated global catalogue lists.
