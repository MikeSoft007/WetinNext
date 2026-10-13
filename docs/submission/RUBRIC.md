# Rubric alignment

The four categories each carry 25%. This document maps evidence to the criteria; it does not predict or claim a grade.

## Uniqueness (25%)

The distinguishing approach is a **goal workspace that connects discovery, action and evidence**. A resource search alone does not show what to do next. A generic job board does not explain which learning and proof of work can help a beginner prepare.

WetinNext connects:

- On-demand sourced web research with a curated catalogue, instead of requiring admins to preload every career.
- A location- and constraint-aware starting plan with practical weekly evidence.
- Several saved aspirations under one profile, each retaining its progress.
- Lesson-cited practice, CV feedback and opportunity preparation, without claiming a quiz makes someone employable.
- Honest coverage gaps: unrelated computing resources and unverifiable openings are excluded instead of filling the screen.

**Demonstrate:** compare a nursing goal with a frontend goal. Their learning content, training routes and plan should differ. Switch back and show that the earlier work remains. A four-week nursing sprint must describe introductory learning and recognised training routes, not clinical qualification.

**Evidence:** discovery, goals and progress frontend features; `matching/research.py`, `matching/quizzes.py`, `learners/goals.py`; goal-isolation, research and assessment tests.

This is an invention-sprint differentiation claim, not evidence that no other product has similar features. The project idea was supplied by the project owner; Codex's contribution was engineering.

## Scalability (25%)

Service ownership and versioned REST contracts separate learner data, content ingestion and AI discovery. Geographic scope is explicit and can change without replacing the learner's saved goals. Text-first preferences reduce unnecessary heavy media, although actual data usage is not measured.

Current scope is Nigeria, Rwanda and Global discovery. Adding another country requires provider coverage, local eligibility/regulation, locale/UI changes and configuration/code updates. It is not yet a country-agnostic production platform. See [the staged expansion plan](SCALABILITY.md).

## Codex usage (25%)

Codex supported implementation, migrations through additive tables, integration debugging, tests, interface iteration and repository preparation. Concrete examples include correcting unrelated recommendations, retaining multiple goals, fixing profile identity, persisting research, and replacing generic quiz links with source-grounded lesson references.

See [Codex usage evidence](CODEX_USAGE.md). Tests and files are inspectable evidence; this repository does not contain a fabricated commit history or an invented productivity metric.

## Presentation (25%)

The submission provides a short reviewer path, stable seeded accounts, a demo script, a service diagram, REST tooling and reproducible verification commands. The app uses focused sections, restrained visual design, preparation signals and explainable source links.

See [the demo](DEMO.md) and [verification](VERIFICATION.md). A final screen recording and slide deck still need to be prepared for the actual submission if required by the organizers.
