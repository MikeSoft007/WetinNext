# Persistent local demo accounts

Open the sign-in page and expand **Use a saved demo account**, or sign in with:

| Account | Email | Role |
| --- | --- | --- |
| Ada Okafor (Nigeria) | ada@wetinnext.local | Learner |
| Jean Uwimana (Rwanda) | jean@wetinnext.local | Learner |
| WetinNext Admin | admin@wetinnext.local | Admin |

Default local demo password: `WetinNextDemo!2026`. Override with `DEMO_SEED_PASSWORD` in backend/.env. These shared credentials are for local PoC use; all account shortcuts and local credential sign-in are disabled when DEMO_MODE=false. The signing secret remains ADMIN_KEY and is never returned by the demo accounts endpoint.

The two learner profiles have starter plans, one sample completed week and labelled sample evidence. Their records use stable identities, so switching browsers or signing out and back in retains the same saved account data. The existing read-only admin preview remains available separately. The seeded admin has administrative write access.

Run from backend:

```sh
.venv/bin/python -m app.services.learners.seed
```

The seed inserts missing sample learners only. It does not reset existing goals, progress, evidence or personal learner records. Running it after deliberately deleting a seeded account recreates that missing sample account. It does not call OpenAI or invent live vacancies.
