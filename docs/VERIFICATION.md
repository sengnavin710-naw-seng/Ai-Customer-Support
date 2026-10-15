# Verification record

## Pre-commit verification — October 15, 2026

- `npm run check`: PASS; lint, build, 20 backend tests and 25 React tests passed.
- `npm run db:up`: BLOCKED; Docker Desktop Linux engine pipe was unavailable, including on retry after attempting to start Docker Desktop.
- `npm run test:db`: FAILED because PostgreSQL was unavailable (`ECONNREFUSED` on localhost:5432). No current database verification is claimed; the October 9 results below are historical.
- Browser checks were not repeated for this commit/push request. No application behavior was changed during this verification.

## Phase 1 access follow-up — October 9, 2026

Inspected the existing implementation before edits. Preview has no authenticated session and deliberately does not fetch Knowledge Base records. The previous exit action was hard to discover. Added a visible banner sign-in action and a Knowledge Base sign-in button; both retain the route through login. Added two route/authentication regression tests, responsive banner wrapping, and an access guide. No backend, credential, or development data changes were needed.

- `npm run check`: PASS after fixing a new test's unsupported Testing Library option; lint, build, 20 backend tests and 25 React tests passed.
- `npm run test:db`: PASS; all 15 real PostgreSQL tests passed in isolated test schemas. Total: **60 passed, 0 failed, 0 skipped**.
- Live runtime: Vite serves the current Knowledge Base module and new sign-in actions; API liveness passes; unauthenticated requests through the frontend proxy to Knowledge Base return 401. No frontend restart was required.
- Read-only database check: PostgreSQL 17 container healthy, one applied migration, zero development categories/articles/approved articles. No records were seeded or deleted from development tables; no credentials or volumes were reset.
- Browser: verified both preview sign-in actions, route preservation, and visible mobile access with no horizontal page overflow. Screenshots: `output/playwright/admin-access-preview.png` and `admin-access-mobile.png`.
- Current authenticated browser inspection remains pending: the user signed in in Chrome, while the connected Codex panel still showed login. The connected panel was reopened for sign-in; no credentials were reset or authentication bypassed. Authenticated workflow coverage above comes from automated tests; earlier browser coverage below used the documented isolated QA environment.

See `docs/ADMIN_WORKSPACE_ACCESS.md` for the UI/API-only distinction and navigation instructions. The earlier isolated browser workflow evidence below remains historical.

## Milestone 2, Phase 1 — October 9, 2026

| Check                                 | Actual result                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run db:up` / `docker compose ps` | PASS; existing PostgreSQL 17 Alpine container healthy; same named volume retained                              |
| `npm run db:migrate`                  | PASS; applied `001_knowledge_base.sql` additively to the development schema                                    |
| Repeat `npm run db:migrate`           | PASS; reported database migrations up to date                                                                  |
| `npm run lint`                        | PASS, zero warnings                                                                                            |
| `npm run build`                       | PASS; shared contracts, NestJS, React type check, Vite bundle                                                  |
| Backend tests                         | PASS; 20 tests (foundation HTTP/configuration + Knowledge Base unit tests)                                     |
| Frontend tests                        | PASS; 23 tests (workspace + API-backed Knowledge Base)                                                         |
| `npm run check`                       | PASS                                                                                                           |
| `npm run test:db`                     | PASS; 15 tests using the running PostgreSQL container                                                          |
| Browser workflow                      | PASS; real login, category creation, Burmese article creation, submit, approve, and API-backed version display |
| Knowledge Base responsive layout      | PASS; no page overflow at 1440px, 390px, or 320px                                                              |
| Browser console                       | 0 errors, 0 warnings                                                                                           |

Total automated tests: **58 passed, 0 failed, 0 skipped**. These are 43 tests without a live database plus 15 real PostgreSQL tests, not 58 database tests.

Database coverage includes schema migration/repeat/concurrency/checksum behavior; category CRUD; article history; Burmese text; pagination, literal search and filters; role/ownership checks; draft/pending/rejected/archived exclusion from the approved view; concurrent edits and stale decisions; persistence across app restart and separate connections; immutable historical content; append-only audit records; and transaction rollback when audit insertion fails.

Real database tests use unique `kb_test_<uuid>` schemas and drop only their own schema after execution. Agent identities are controlled fixtures attached to real test sessions; authorization guards, services, SQL, and transactions execute normally. The development `.env`, credentials, existing application tables, and database volume are not reset. Production identity remains unimplemented.

Browser QA used a separate API process, temporary in-memory credentials, and an isolated `kb_browser_<uuid>` schema in the running PostgreSQL container. No mocked browser API responses were used. The temporary servers were stopped and only the browser QA schema was removed afterward. The development schema retains its applied migration and has zero seeded articles/categories. Screenshots are stored locally under ignored `output/playwright/knowledge-desktop.png` and `output/playwright/knowledge-mobile.png`.

The user also confirmed the previously outstanding Milestone 1 database test and Burmese UTF-8 round-trip passed. The original record below is retained as historical evidence, superseded by the current database results above.

## Original Milestone 1 implementation verification (historical)

Verified on October 9, 2026. Initial repository inspection found an empty directory (including no Git metadata); no existing project files were overwritten.

## Results

| Check                         | Result                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `npm run lint`                | PASS, zero warnings (ESLint 10)                                              |
| `npm run build`               | PASS, shared type declarations, NestJS API, React type check and Vite bundle |
| `npm test`                    | PASS, 16 API/configuration tests + 10 React tests                            |
| `npm run check`               | PASS after final code and formatting changes                                 |
| Dependency installation audit | 0 known vulnerabilities reported for 411 audited packages                    |
| Live `GET /api/health`        | PASS, HTTP 200 with `status: ok`                                             |
| Browser preview               | PASS, desktop 1440px, mobile 390px, narrow mobile 320px                      |
| Horizontal page overflow      | None at 1440px, 390px, or 320px after chart layout correction                |
| Burmese fonts                 | Bundled locally; browser font loading completed                              |
| Final browser console         | 0 errors, 0 warnings                                                         |
| Browser navigation            | Sample preview, mobile menu, Settings route and return control inspected     |
| PostgreSQL container startup  | NOT RUN: Docker executable is unavailable on this host                       |
| `npm run test:db`             | NOT RUN: requires a running development PostgreSQL instance                  |

The real database test is separate and is not included in the 26 passing tests. API integration tests stub database readiness; they do not prove a PostgreSQL connection works. Docker Compose runtime verification remains outstanding.

## Test coverage

API: public liveness, security/cache headers, default-deny authentication, admin login, protected sample data and metric totals, identity endpoint, bad credentials, input validation, role injection rejection, login throttling, oversized payloads, malformed JSON redaction, token tampering, logout revocation, session expiry, agent-role denial, readiness success/failure, CORS origin, environment validation and secret-safe errors.

React: initial sign-in screen, explicitly labeled sample mode, Burmese message rendering, all five placeholder routes, protected dashboard loading, login errors, loading state, failed dashboard retry, expired session recovery, sign-out, API downtime/refresh, mobile navigation and Escape dismissal.

Browser inspection found and corrected remote font timeouts, missing favicon, and narrow-screen chart overflow. Remote fonts were replaced with local font packages. Temporary HMR errors during batch formatting resolved after a fresh navigation; the final browser session was rechecked.

## Local artifacts

Ignored browser screenshots are in `output/playwright/`:

- `dashboard-desktop.png`
- `dashboard-mobile.png`
- `settings-mobile.png`

## Finish database verification on a Docker-enabled machine

```sh
npm run setup
npm run db:up
npm run test:db
```

Then sign in and call `GET /api/health/ready` using the returned bearer token. Expected status is 200 with `database: connected`. Use a synthetic development database only.
