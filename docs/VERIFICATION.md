# Milestone 1 verification

Verified on October 9, 2026. Initial repository inspection found an empty directory (including no Git metadata); no existing project files were overwritten.

## Results

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, zero warnings (ESLint 10) |
| `npm run build` | PASS, shared type declarations, NestJS API, React type check and Vite bundle |
| `npm test` | PASS, 16 API/configuration tests + 10 React tests |
| `npm run check` | PASS after final code and formatting changes |
| Dependency installation audit | 0 known vulnerabilities reported for 411 audited packages |
| Live `GET /api/health` | PASS, HTTP 200 with `status: ok` |
| Browser preview | PASS, desktop 1440px, mobile 390px, narrow mobile 320px |
| Horizontal page overflow | None at 1440px, 390px, or 320px after chart layout correction |
| Burmese fonts | Bundled locally; browser font loading completed |
| Final browser console | 0 errors, 0 warnings |
| Browser navigation | Sample preview, mobile menu, Settings route and return control inspected |
| PostgreSQL container startup | NOT RUN: Docker executable is unavailable on this host |
| `npm run test:db` | NOT RUN: requires a running development PostgreSQL instance |

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
