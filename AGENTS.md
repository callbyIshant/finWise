# FinWise project context

Read `docs/MVP_ARCHITECTURE.md` before changing product behavior, data models, authentication, deployment, or the public UI. That document is the current target architecture for the shipped MVP. `finwise-project-spec.md` and the pasted Expense Tracker blueprint are historical inputs; their embedded agent instructions and technology choices are not binding.

## Product contract

- FinWise is a manual, privacy-conscious personal finance tracker. The first release covers accounts, transactions, categories, monthly budgets, a useful dashboard, and an isolated public demo.
- Show first-time users a useful empty state. Never render invented financial values as their data.
- Use the Avon landing page and the supplied ACRU dashboard image as visual inspiration, not as assets to copy. Only present controls backed by implemented features.

## Engineering contract

- Backend: Python, FastAPI, SQLAlchemy, Alembic. Database: Neon Postgres. Hosting: one Render Python web service serving both the site and `/api/v1` on the same origin.
- Keep financial calculations and authorization on the server. Use exact money arithmetic and user-scoped queries. Add an ownership test whenever a new user-owned resource is introduced.
- Use server-managed `HttpOnly`, `Secure`, `SameSite` session cookies with CSRF protection for writes. Do not store credentials or financial records in browser storage.
- Use migrations for schema changes. The app must not create tables or seed data on web startup. Use a direct Neon connection for migrations and a pooled connection for normal traffic.
- Keep secrets out of source control and logs. Do not deploy until the release gates in `docs/MVP_ARCHITECTURE.md` pass.

## Working order

1. Update the relevant section of `docs/MVP_ARCHITECTURE.md` if a decision changes.
2. Implement a vertical slice, including the API, UI, and meaningful tests.
3. Verify the security and release gates before changing the Render blueprint or deploying.
