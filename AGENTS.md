# Project development rules

- Implement only the milestone requested by the user. See PLAN.md for scope and acceptance criteria.
- Preserve existing work; inspect files before changing them. Use npm workspaces and strict TypeScript.
- Keep a modular monolith: NestJS modules own their features; React calls HTTP APIs; shared contracts have no framework dependencies.
- Use synthetic data only. Never connect real customer data or implement financial transactions.
- Never hardcode or commit credentials. Keep secrets server-side in ignored environment files; VITE_* is public.
- Protect APIs by default. Explicitly mark public endpoints, enforce server-side roles, and validate all external input.
- Future AI code must use application services and narrowly authorized tools. AI must never access the database directly.
- Do not implement RAG, pgvector, Socket.IO, imports, or external integrations during Milestone 1.
- Support Burmese Unicode and responsive, accessible interfaces. Label mock data and planned features honestly.
- Write meaningful tests for implemented behavior. Run `npm run check`; fix failures and report anything not run.
- Database verification requires Docker/PostgreSQL: run `npm run db:up` and `npm run test:db`. Never describe mocks as database integration tests.
- Keep README.md and PLAN.md aligned with code, setup steps, limitations, and verification results.
- Never claim production readiness from a successful build. Current authentication is intentionally development-only.
