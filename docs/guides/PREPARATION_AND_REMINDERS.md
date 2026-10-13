# Goal preparation and reminders

Progress compares each saved goal across five recorded signals: a saved plan, at least one completed practice week, saved evidence, a submitted quiz and a goal-specific CV review. Click a cell to open that action; selecting another goal restores its workspace first. This is an activity tracker, not a validated mastery or hiring-readiness score.

Build my researched plan opens the roadmap in Discover and starts goal research if no guide is saved. Open my in-app practice & evidence check opens the practice section in Progress. If there is no researched plan, the check provides a plan-building action instead of silently doing nothing.

Focus reminders are saved per goal in Progress. Choose weekdays, local time, timezone and focus area. Due reminders appear on Today when the learner returns; marking a reminder seen acknowledges the latest due occurrence. Delivery is in-app only. Email, Telegram and background push delivery are not implemented by these settings.

REST endpoints under /api/v1: GET /me/preparation, GET/PUT /me/reminders, POST /me/reminders/acknowledge. Authenticated identity owns all records. Account deletion includes reminder preferences. Days use Monday=0 through Sunday=6; timezone uses IANA names.

## Configurable practice

Learners choose any integer from 1 to 20 questions, with beginner (recognition), intermediate (application) or advanced (reasoning through fictional scenarios) difficulty. Difficulty remains within source subjects and healthcare safety restrictions; it is not an accredited competency level.

POST /me/assessment accepts `{ "question_count": 8, "difficulty": "intermediate" }`. Omitting the body keeps four beginner questions for existing clients. A pending attempt with identical settings is resumed; different settings create another attempt. Public attempt payloads contain count/difficulty/questions and never expose the answer key until submission. Submit requires exactly one answer for each stored question; scores and totals use the actual count. Legacy attempts remain usable.

The player shows one question at a time with answered progress, numbered navigation and back/next actions. Results include a score ring and expandable explanations with source links. Completed results persist; answers entered before submission currently remain in the open page and are not saved across reloads.

## Timed practice and compact pages

Quiz settings also accept `time_limit_minutes` from 0 to 60. Zero is untimed; the UI starts at ten minutes. The server saves an absolute deadline after generating the questions, and the client countdown reads that deadline. Reloading does not reset it. At zero, answers lock and the learner submits the attempt; unanswered questions count as incorrect. This is a personal practice timer, not a proctored exam. Answer choices entered before submission remain page state and are not restored across reloads.

Today separates weekly work and check-in. Progress separates overview, skills, quiz, evidence and history; switching its sections preserves the mounted quiz. Discover paginates training and opportunity lists and uses expandable week details. Quiz feedback, goal rows and skill milestones also paginate to limit page length.

## Answer review and lesson references

New quiz results record the selected and correct answer separately. The quiz engine searches specific lessons on the plan resource providers, uses cited lesson evidence and validates each question URL against retrieved citations and the associated provider. Broad subject directories, book indexes and prefaces are excluded. Tracking query parameters are removed. Sources remain attribution, not independent factual validation of AI-generated practice.

Older results may lack a saved selected answer or a specific lesson citation. The UI labels those limitations rather than inventing missing answers or replacing links with guessed chapters. Generate a new set to use the updated lesson workflow.
