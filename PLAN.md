# Implementation plan

## Milestone 1 — Foundation (verified)

Acceptance criteria:

- [x] npm workspace monorepo: React/Vite web, NestJS API, shared contracts.
- [x] Strict TypeScript, linting, lockfile, environment examples, setup instructions.
- [x] Responsive admin overview with explicitly synthetic Burmese conversations and metrics.
- [x] Navigable Inbox, Knowledge Base, Tickets, Analytics, and Settings placeholders.
- [x] Working public `GET /api/health` liveness endpoint.
- [x] Development authentication, admin authorization, validation, limits, and session revocation.
- [x] PostgreSQL Compose configuration, persistent volume, loopback binding, readiness probe.
- [x] Build, lint, and automated API/UI tests pass.
- [x] PostgreSQL 17 Alpine healthy; real database and Burmese UTF-8 round-trip tests passed. User verification confirmed, and rechecked during Milestone 2 Phase 1.

Required commands:

```sh
npm ci
npm run check
npm run db:up
npm run test:db
```

Manual acceptance: open the app at desktop and mobile sizes; enter sample preview; navigate all five placeholders; verify Burmese text, menu behavior, loading/error/retry states, and API status. Sign in with generated local credentials and sign out. A successful frontend build is not a substitute for API or database verification.

## Milestone 2, Phase 1 — Persistent Knowledge Base (implemented; stop here)

Acceptance criteria:

- [x] Additive, transactional PostgreSQL migrations with advisory locking, checksum validation, and safe repeated execution. Existing volume preserved.
- [x] Category CRUD; article create/read/version/archive; historical category assignments retained.
- [x] Immutable version content and draft → pending → approved/rejected workflow. Rejected articles require a new draft version before resubmission.
- [x] Only the current approved version of an active article appears in `kb_approved_articles`. Editing or archiving removes eligibility immediately.
- [x] Protected REST endpoints, validated bodies/queries/UUIDs, literal substring search, bounded pagination, and sanitized failures.
- [x] Server-side admin/agent RBAC and author ownership. Category administration, review, archive, and audit access require admin.
- [x] Atomic, append-only audit records with actor, role, action, record ID and version; no content or credentials in audit payloads.
- [x] API-backed Knowledge Base UI with category management, article editor, review controls, history, audit records, pagination, loading/error/retry states. Public preview requires sign-in for Knowledge Base.
- [x] PostgreSQL tests verify migrations, persistent data across restart, Unicode, concurrency, authorization, approval gating, history immutability, and rollback on audit failure.
- [x] `npm run check`: lint and build passed; 20 backend tests and 23 frontend tests passed.
- [x] `npm run test:db`: 15 real PostgreSQL tests passed.
- [x] Browser authoring/review workflow and responsive layouts verified at 1440px, 390px and 320px using isolated synthetic data.

Commands:

```sh
npm run db:up
npm run db:migrate
npm run check
npm run test:db
npm run dev
```

Implementation details and role matrix: `docs/KNOWLEDGE_BASE.md`. Actual results: `docs/VERIFICATION.md`.

### Milestone 2, later phases — not implemented

Phase 1 access follow-up (October 9, 2026): added visible preview-to-admin sign-in actions while preserving the Knowledge Base route; documented UI navigation and API-only audit access in `docs/ADMIN_WORKSPACE_ACCESS.md`. `npm run check` passed (20 backend + 25 React tests); `npm run test:db` passed (15 PostgreSQL tests). No Phase 2 work or development-data reset.

- Persistent users, role administration, production session lifecycle, and production authentication.
- Stronger reviewer separation (Phase 1 explicitly permits admin self-approval with audit records).
- Production database role separation, backup/restore operations, and deployment checks.

Current login remains one development administrator with in-memory sessions. Agent principals are exercised in tests; no agent provisioning UI or production identity system was added. No RAG, AI auto-replies, imports, pgvector, realtime, or Meta Messenger integration is part of Phase 1.

## Later milestones — planning only

3. Synthetic CSV/JSON import, validation, deduplication, preview, and rollback. Acceptance: malformed rows are isolated and repeat imports are idempotent.
4. pgvector retrieval and OpenAI Responses API, citations, Burmese answer evaluations, abstention, and prompt-injection boundaries. Acceptance: responses use approved sources; no direct AI database access; synthetic evaluation suite passes.
5. Unified inbox, human handoff, support tickets, and Socket.IO. Acceptance: assignment and handoff are authorized, durable, and tested across reconnects.
6. Secure existing-backend APIs, scoped credentials, audit logs, and real analytics. Acceptance: least privilege, allowlisted tools, timeouts, redaction, and integration tests. No financial transactions.

Each later milestone needs its own reviewed acceptance criteria and test commands before implementation.
