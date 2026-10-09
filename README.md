# Mingalar Support

A Burmese-first customer support foundation. **Milestone 1 only**: React admin workspace, NestJS modular monolith, synthetic sample data, development authentication, and PostgreSQL development configuration. No AI calls, RAG, realtime, customer imports, or business integrations are implemented.

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
npm run dev
```

Open http://localhost:5173. The API listens at http://127.0.0.1:3000/api. Both development servers bind to loopback only. `npm run dev` runs both servers; Ctrl+C stops them together.

`setup` creates an ignored root `.env`, generates a random database password, and prints a random admin password once. Only a salted scrypt hash of the admin password is stored. Save that password locally; sign in as `admin@example.test`. Existing `.env` files are preserved.

**This workspace already has a generated `.env` from verification. To get your own local admin password, run:**

```sh
npm run setup -- --reset-admin
```

Restart `npm run dev` after resetting. This changes only the admin password hash, preserving database credentials and data. Never paste credentials into chat, commits, or screenshots.

You may explore the public **sample workspace** without credentials or PostgreSQL. Preview data is bundled fictional content and grants no API access. Signed-in users load the same illustrative dashboard from an admin-protected endpoint. Refreshing the browser returns to sign in because tokens are held only in memory.

If Docker is unavailable, skip `db:up`: the API and dashboard still run. Database readiness will return 503 until PostgreSQL is reachable. The dashboard's “API online” badge reports liveness, not database readiness.

## Structure

```text
apps/
  api/src/
    auth/         Development login, opaque sessions, default-deny role guard
    dashboard/    Admin-protected synthetic overview
    database/     PostgreSQL pool and bounded readiness check
    health/       Liveness and database readiness endpoints
  api/test/       HTTP integration, configuration, real PostgreSQL test
  web/src/        React routes, dashboard, login, placeholders, CSS, UI tests
packages/contracts/src/   Shared API types (no framework dependencies)
scripts/setup.mjs         Local environment and credential generation
compose.yaml              Local PostgreSQL and persistent named volume
AGENTS.md                 Development rules
PLAN.md                   Milestones and acceptance criteria
docs/VERIFICATION.md      Actual check results and limitations
```

Feature modules stay within one backend process. Controllers use services; only backend application code can access the database. Future AI integration must go through narrowly scoped application services; never expose database credentials or SQL execution to a model. Placeholder routes currently exist only in the frontend.

## Commands

| Command                          | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `npm run setup`                  | Generate local `.env` without overwriting existing configuration      |
| `npm run setup -- --reset-admin` | Generate a fresh local admin password; restart API afterward          |
| `npm run dev`                    | Run web and API with file watching                                    |
| `npm run lint`                   | ESLint, zero warnings                                                 |
| `npm run build`                  | Compile shared contracts and API; type-check and bundle web           |
| `npm test`                       | 16 API/config tests and 10 React tests; no live database required     |
| `npm run check`                  | Lint, build, then tests                                               |
| `npm run db:up`                  | Start PostgreSQL and wait for health check                            |
| `npm run db:down`                | Stop PostgreSQL; retain its named data volume                         |
| `npm run test:db`                | Real PostgreSQL connection and parameterized Burmese UTF-8 round-trip |
| `npm run start -w @support/api`  | Start the built API using local `.env`                                |

The API tests use Nest's testing module and Supertest, execute the real guards/controllers/validation, and stub **only database readiness**. UI tests use Vitest, Testing Library, and mocked HTTP clients. The separate `test:db` command uses a real PostgreSQL connection. There are no database schema migrations yet because Milestone 1 persists no domain records.

## API contract

| Method | Endpoint            | Access               | Behavior                                                        |
| ------ | ------------------- | -------------------- | --------------------------------------------------------------- |
| GET    | `/api/health`       | Public               | 200 `{ status: "ok", service: "support-api", timestamp }`       |
| POST   | `/api/auth/login`   | Public, rate-limited | Validated `{ email, password }`; returns token, expiry and user |
| GET    | `/api/auth/me`      | Bearer session       | Current authenticated user                                      |
| POST   | `/api/auth/logout`  | Bearer session       | Revoke session; 204                                             |
| GET    | `/api/dashboard`    | Admin                | Explicitly synthetic dashboard fixtures                         |
| GET    | `/api/health/ready` | Admin                | 200 when `SELECT 1` succeeds; 503 otherwise                     |

Use `Authorization: Bearer <accessToken>` for protected calls. Login is limited to five attempts per minute per IP; other endpoints to 100 requests/minute. Invalid input returns 400, missing/expired sessions 401, disallowed roles 403. Unknown DTO fields are rejected. JSON bodies are capped at 16 KB. Passwords accept 12–128 characters. Sessions expire after 30 minutes and are invalidated on logout or API restart. This bootstrap has one administrator; the guard also tests denial for the future `agent` role, but user/role management is not implemented.

Quick liveness check:

```sh
curl http://127.0.0.1:3000/api/health
```

## Configuration

See root `.env.example` and `apps/web/.env.example`. The backend validates environment variables at startup and rejects missing hashes and production mode. Root `.env` supplies Compose and the API. `WEB_ORIGIN` is the exact browser origin, default `http://localhost:5173`. Vite proxies `/api` to port 3000 during development. If you change `API_PORT`, update the proxy in `apps/web/vite.config.ts` too.

To use a separately hosted API, copy the web environment example to `apps/web/.env.local` and set `VITE_API_BASE_URL` to the API origin (without `/api`). All `VITE_*` values are public. Configure backend CORS to that browser origin. A production frontend host also needs SPA history fallback and `/api` reverse proxying; `vite preview` alone does not configure a production API proxy.

PostgreSQL is bound to `127.0.0.1:5432`, uses a named volume, and contains no customer data. With an existing volume, changing `POSTGRES_PASSWORD` does not change the database user's password automatically. Keep the existing password or deliberately rotate it in PostgreSQL. `db:down` keeps data; no routine setup command deletes volumes.

## Scope and production limits

This is a production-oriented **foundation, not a production deployment**. In-memory bootstrap sessions and rate-limit storage are development-only; `NODE_ENV=production` deliberately fails closed. Before deployment, implement durable identity/session management, secret management, TLS/proxy policy, migrations, observability, backups, and deployment checks. No OpenAI key is needed in Milestone 1.

Dashboard metrics, trends, channel distribution, names, timestamps, and Burmese messages are invented examples. Channel names do not imply connected channels. All placeholder pages explicitly identify planned work. Locale text indicates Burmese/English content support; full UI translation is future work. Milestone 2 is planned in PLAN.md and has not been implemented.

Framework reference: [NestJS authorization](https://docs.nestjs.com/security/authorization), [Vite documentation](https://vite.dev/guide/).
