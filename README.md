# Mingalar Support

A Burmese-first customer support foundation. **Milestone 2, Phase 1** adds a persistent, API-backed Knowledge Base with categories, immutable article versions, approval workflow, RBAC, and audit records. The overview still uses synthetic sample metrics. Authentication remains development-only. No AI calls, RAG, realtime, customer imports, or business integrations are implemented.

## Requirements

- Node.js 24 recommended (`.nvmrc`); Node 22.13+ within the 22.x release is also supported. npm 10+.
- Docker Desktop with Compose v2 for PostgreSQL, or a local PostgreSQL 17 instance.
- Do not connect production databases or real customer data.

## Quick start

From the repository root:

```sh
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run dev
```

Open http://localhost:5173. The API listens at http://127.0.0.1:3000/api. Both development servers bind to loopback only. `npm run dev` runs both servers; Ctrl+C stops them together.

`setup` creates an ignored root `.env`, generates a random database password, and prints a random admin password once. Only a salted scrypt hash of the admin password is stored. Save that password locally; sign in as `admin@example.test`. Existing `.env` files are preserved.

**For an existing workspace, use your existing development credentials.** Open `/knowledge-base` and sign in, or choose **Sign in to Admin Workspace** from sample preview. You do not need to reset credentials, rerun setup, or change the database to leave preview. Never paste credentials into chat, commits, or screenshots. See [Admin Workspace access](docs/ADMIN_WORKSPACE_ACCESS.md) for exact navigation and API-only features.

You may explore the public **sample workspace** without credentials or PostgreSQL. Preview data is bundled fictional content and grants no API access. Signed-in users load the same illustrative dashboard from an admin-protected endpoint. Refreshing the browser returns to sign in because tokens are held only in memory.

The Knowledge Base requires PostgreSQL and the migration. If PostgreSQL is unavailable, the synthetic overview can still run, while Knowledge Base reports a storage error. The dashboard's “API online” badge reports liveness, not database readiness.

## Structure

```text
apps/
  api/src/
    auth/         Development login, opaque sessions, default-deny role guard
    dashboard/    Admin-protected synthetic overview
    database/     PostgreSQL pool, transactions, migrations, readiness check
    knowledge-base/  Categories, article versions, approval, RBAC, audit
    health/       Liveness and database readiness endpoints
  api/migrations/ Additive, checksummed SQL migrations
  api/test/       HTTP integration, unit tests, isolated-schema PostgreSQL tests
  web/src/        React routes, dashboard, login, placeholders, CSS, UI tests
packages/contracts/src/   Shared API types (no framework dependencies)
scripts/setup.mjs         Local environment and credential generation
compose.yaml              Local PostgreSQL and persistent named volume
AGENTS.md                 Development rules
PLAN.md                   Milestones and acceptance criteria
docs/VERIFICATION.md      Actual check results and limitations
docs/KNOWLEDGE_BASE.md    Schema, REST contract, approval rules and role matrix
```

Feature modules stay within one backend process. Controllers use services; only backend application code can access the database. Future AI integration must go through narrowly scoped application services and the approved-only view; never expose database credentials or SQL execution to a model. Inbox, Tickets, Analytics, and Settings remain placeholders/read-only foundation screens.

## Commands

| Command                          | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `npm run setup`                  | Generate local `.env` without overwriting existing configuration     |
| `npm run setup -- --reset-admin` | Generate a fresh local admin password; restart API afterward         |
| `npm run dev`                    | Run web and API with file watching                                   |
| `npm run lint`                   | ESLint, zero warnings                                                |
| `npm run build`                  | Compile shared contracts and API; type-check and bundle web          |
| `npm test`                       | Backend and React tests; no live database required                  |
| `npm run check`                  | Lint, build, then tests                                              |
| `npm run db:up`                  | Start PostgreSQL and wait for health check                           |
| `npm run db:down`                | Stop PostgreSQL; retain its named data volume                        |
| `npm run db:migrate`             | Apply additive SQL migrations transactionally; safe to repeat        |
| `npm run test:db`                | 15 real PostgreSQL tests, including Knowledge Base and Burmese UTF-8 |
| `npm run start -w @support/api`  | Start the built API using local `.env`                               |

The foundation API tests use Nest's testing module and Supertest with stubbed database readiness. Knowledge Base unit tests cover validation, permission checks, and sanitized error mapping. React tests use Vitest, Testing Library, and mocked HTTP clients. The separate `test:db` command uses the running PostgreSQL container, real transactions, real guards and controllers, and fixture identities for agent-role scenarios. Tests create and drop only a uniquely named test schema; they never reset the volume or clear development tables. The database user needs permission to create test schemas. Do not run against customer/production databases.

## API contract

| Method | Endpoint            | Access               | Behavior                                                        |
| ------ | ------------------- | -------------------- | --------------------------------------------------------------- |
| GET    | `/api/health`       | Public               | 200 `{ status: "ok", service: "support-api", timestamp }`       |
| POST   | `/api/auth/login`   | Public, rate-limited | Validated `{ email, password }`; returns token, expiry and user |
| GET    | `/api/auth/me`      | Bearer session       | Current authenticated user                                      |
| POST   | `/api/auth/logout`  | Bearer session       | Revoke session; 204                                             |
| GET    | `/api/dashboard`    | Admin                | Explicitly synthetic dashboard fixtures                         |
| GET    | `/api/health/ready` | Admin                | 200 when `SELECT 1` succeeds; 503 otherwise                     |

Use `Authorization: Bearer <accessToken>` for protected calls. Login is limited to five attempts per minute per IP; other endpoints to 100 requests/minute. Invalid input returns 400, missing/expired sessions 401, disallowed roles 403. Unknown DTO fields are rejected. JSON bodies are capped at 64 KB to support Burmese article content (10,000-character maximum). Passwords accept 12–128 characters. Sessions expire after 30 minutes and are invalidated on logout or API restart. This bootstrap has one administrator; Knowledge Base supports and tests the `agent` role at the server boundary, but user/role provisioning is not implemented.

Knowledge Base routes are under `/api/knowledge-base`: category and article CRUD, version history, submit/review actions, and admin audit access. See [Knowledge Base contract](docs/KNOWLEDGE_BASE.md) for routes, payloads, pagination, permissions, and approval semantics.

Quick liveness check:

```sh
curl http://127.0.0.1:3000/api/health
```

## Configuration

See root `.env.example` and `apps/web/.env.example`. The backend validates environment variables at startup and rejects missing hashes and production mode. Root `.env` supplies Compose and the API. `WEB_ORIGIN` is the exact browser origin, default `http://localhost:5173`. Vite proxies `/api` to port 3000 during development. If you change `API_PORT`, set the web dev process environment `API_PROXY_TARGET` to the new API origin. This is a server-only development proxy setting, not a browser secret.

To use a separately hosted API, copy the web environment example to `apps/web/.env.local` and set `VITE_API_BASE_URL` to the API origin (without `/api`). All `VITE_*` values are public. Configure backend CORS to that browser origin. A production frontend host also needs SPA history fallback and `/api` reverse proxying; `vite preview` alone does not configure a production API proxy.

PostgreSQL is bound to `127.0.0.1:5432`, uses a named volume, and contains no customer data. With an existing volume, changing `POSTGRES_PASSWORD` does not change the database user's password automatically. Keep the existing password or deliberately rotate it in PostgreSQL. `db:down` keeps data; no routine setup command deletes volumes.

## Scope and production limits

This is a production-oriented **foundation, not a production deployment**. In-memory bootstrap sessions and rate-limit storage are development-only; `NODE_ENV=production` deliberately fails closed. Before deployment, implement durable identity/session management, secret management, TLS/proxy policy, migrations, observability, backups, and deployment checks. No OpenAI key is needed in Milestone 1.

Dashboard metrics, trends, channel distribution, names, timestamps, and Burmese messages are invented examples. Channel names do not imply connected channels. Knowledge Base starts empty and stores only the content you author; use synthetic content during development. Administrators may explicitly approve their own articles in Phase 1, and all decisions are audited. Editing an approved article creates a draft and removes it from the approved-only view until reviewed again. Locale text indicates Burmese/English content support; full UI translation is future work. Later phases are listed in PLAN.md and remain unimplemented.

Framework reference: [NestJS authorization](https://docs.nestjs.com/security/authorization), [Vite documentation](https://vite.dev/guide/).
