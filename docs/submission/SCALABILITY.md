# Geographic scalability

The proof of concept demonstrates an expansion strategy; it does not claim production-scale throughput or measured multi-country impact.

| Dimension | Implemented now | Next step |
| --- | --- | --- |
| Geography | Nigeria/Rwanda/Global market scopes, regional map context and goal-scoped research | Add markets to schemas/UI, maintained provider adapters and local eligibility rules |
| Language | English interface and guidance | Human-reviewed French/Pidgin translations, accessible terminology and language-specific retrieval/evaluation |
| Access | Text-first preferences, no compulsory images, links to free learning | Measure real mobile data use, cache useful guides and evaluate basic-device usability |
| Content | Public adapters, publication gates, freshness metadata and on-demand web research | Country/provider coverage monitoring, editorial accountability and local partnerships |
| Identity | Stable seeded local identities and Supabase JWT verification foundation | Verify live account flows, refresh sessions and complete Telegram linking |
| Compute | Independent HTTP services, bounded research jobs and explicit AI errors | Durable distributed queue, retry budgets, per-user quotas and operational metrics |
| Storage | Separate learner/catalogue/research ownership, local SQLite prototype | Migrations and managed stores; catalogue/research need SQLite-specific code changes |
| Privacy | Scoped access, original CVs not retained, erasure tests and private credentials | Formal retention policy, threat review, deployment controls and consent review |
| Quality | Traceable sources, exact cited lesson validation, regulated-career constraints | Domain expert evaluation, country-specific accreditation checks and diverse learner testing |

## A practical rollout sequence

1. **Strengthen the first two markets.** Test across unrelated goals, rural/mobile constraints, educational levels and local opportunity availability. Record coverage gaps and harmful or irrelevant recommendations.
2. **Add a neighboring market deliberately.** Identify institutions/regulators and public sources; extend market enums, country labels and map extents. Run the same goal and eligibility tests before inviting learners.
3. **Add language support with local reviewers.** Translate user flows and test whether sources and terminology are useful, rather than translating only buttons.
4. **Scale the infrastructure after usage evidence.** Move database-specific stores and background jobs to managed infrastructure. Measure latency, spend, errors and source freshness before making throughput claims.

The key reusable unit is a learner's goal context plus retrieval/source adapters, not a country-specific course catalogue. Local curricula, licensure and admission remain local responsibilities.
