# Implementation plan

## Milestone 1 — Foundation (current scope)

Acceptance criteria:

- [x] npm workspace monorepo: React/Vite web, NestJS API, shared contracts.
- [x] Strict TypeScript, linting, lockfile, environment examples, setup instructions.
- [x] Responsive admin overview with explicitly synthetic Burmese conversations and metrics.
- [x] Navigable Inbox, Knowledge Base, Tickets, Analytics, and Settings placeholders.
- [x] Working public `GET /api/health` liveness endpoint.
- [x] Development authentication, admin authorization, validation, limits, and session revocation.
- [x] PostgreSQL Compose configuration, persistent volume, loopback binding, readiness probe.
- [x] Build, lint, and automated API/UI tests pass.
- [ ] Verify PostgreSQL startup and real database test on a Docker-enabled machine. Docker is unavailable on the implementation host.

Required commands:

```sh
npm ci
npm run check
npm run db:up
npm run test:db
```

Manual acceptance: open the app at desktop and mobile sizes; enter sample preview; navigate all five placeholders; verify Burmese text, menu behavior, loading/error/retry states, and API status. Sign in with generated local credentials and sign out. A successful frontend build is not a substitute for API or database verification.

## Milestone 2 — Persistent support knowledge and identity (planned, not implemented)

- Define migration tooling and PostgreSQL schemas for users, roles, knowledge articles, and article revisions.
- Replace bootstrap admin/in-memory sessions with persistent identity and production-appropriate session lifecycle.
- Implement validated knowledge article create/read/update/archive workflows, including Burmese Unicode.
- Enforce admin/agent permissions at service boundaries; add audit records for knowledge changes.
- Keep all fixtures synthetic. Add migration, permission, persistence, and API/UI workflow tests.

Acceptance: migrations reproduce a clean database; authorized article changes survive restart; unauthorized writes fail; Burmese text round-trips; audit events identify actor/action/record without logging secrets. All checks pass against PostgreSQL. No RAG or live customer integration yet.

Expected commands: `npm run check`, `npm run test:db`; migration and end-to-end commands must be added with the implementation.

## Later milestones — planning only

3. Synthetic CSV/JSON import, validation, deduplication, preview, and rollback. Acceptance: malformed rows are isolated and repeat imports are idempotent.
4. pgvector retrieval and OpenAI Responses API, citations, Burmese answer evaluations, abstention, and prompt-injection boundaries. Acceptance: responses use approved sources; no direct AI database access; synthetic evaluation suite passes.
5. Unified inbox, human handoff, support tickets, and Socket.IO. Acceptance: assignment and handoff are authorized, durable, and tested across reconnects.
6. Secure existing-backend APIs, scoped credentials, audit logs, and real analytics. Acceptance: least privilege, allowlisted tools, timeouts, redaction, and integration tests. No financial transactions.

Each later milestone needs its own reviewed acceptance criteria and test commands before implementation.
