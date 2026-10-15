# Knowledge Base — Milestone 2, Phase 1

## Scope and data boundaries

Categories and articles are stored in PostgreSQL. There are no automatic seeds, customer imports, AI calls, vector indexes, or Messenger integrations. The browser receives only API responses; database credentials remain server-side. Authentication is the existing **development-only** administrator bootstrap. Agent permissions are implemented at controller and service boundaries and exercised through synthetic test principals. Persistent identity and role provisioning are later work.

## Schema and migration operation

`apps/api/migrations/001_knowledge_base.sql` creates:

- `kb_categories`: case-insensitive unique name, description, revision and timestamps.
- `kb_articles`: current version pointer, category, original author, revision, archival timestamp.
- `kb_article_versions`: title, plain-text body, language, category snapshot, creator, submission and review metadata. Content is immutable; edits insert a new version.
- `kb_audit_records`: append-only actor ID, actor role, action, entity ID, version, timestamp. No article content, review notes, passwords, or access tokens are copied into audit records.
- `kb_approved_articles`: current approved versions of active articles only.
- `schema_migrations`: migration filename, SHA-256 checksum, application timestamp.

Run `npm run db:migrate` before opening Knowledge Base. The runner applies migrations in one transaction, takes a schema-scoped advisory lock, rejects changed/missing applied migration files, and is safe to run repeatedly. Line endings are normalized when calculating checksums. Never edit an applied migration: add a subsequent forward migration. No rollback/reset/volume deletion command is provided. If a migration fails, its transaction rolls back; inspect database availability and the checked-in migration history. Take backups before future changes to non-disposable environments.

Foreign keys protect category references, including historical version categories. The current-version foreign key is deferred until commit so creation of an article and its first version is atomic. Foreign-key, status, ordering, and audit lookups have indexes. Search is parameterized, literal, case-insensitive substring matching across current titles/bodies (and category names/descriptions). `%`, `_`, and backslash are escaped. It deliberately avoids English tokenization so Burmese substring matching works. Substring search can scan rows; trigram indexing and larger-scale search tuning are deferred.

Mutations use short transactions and row locks, checking `expectedRevision` before any changes. A successful mutation and its audit record commit together. Failed mutations leave no partial versions, metadata, or audit records. Lock conflicts return 409; connection/schema failures return sanitized 503 responses. Database triggers reject version-content changes and audit updates/deletes. These controls do not replace production database role separation: the development database owner remains privileged.

## Role matrix

| Operation                                             | Agent | Admin |
| ----------------------------------------------------- | ----- | ----- |
| Read/search categories, articles, and version history | Yes   | Yes   |
| Create article draft                                  | Yes   | Yes   |
| Edit/submit own article                               | Yes   | Yes   |
| Edit/submit another author's article                  | No    | Yes   |
| Create/update/delete categories                       | No    | Yes   |
| Approve/reject a pending version                      | No    | Yes   |
| Archive articles                                      | No    | Yes   |
| Read audit records                                    | No    | Yes   |

Phase 1 permits administrator self-approval explicitly, since the bootstrap exposes one admin. This is **not** a two-person review policy. Review actor/time/note are retained; stronger reviewer separation requires later identity work.

## Approval and retrieval eligibility

```text
create / edit → new draft version → submit → pending → approve → approved
                                                    └ reject → rejected
rejected → edit → new draft version (then submit again)
```

Pending versions cannot be edited. A reviewer must approve or reject them first. Approving a draft directly, resubmitting a rejected version, changing a reviewed version, or using a stale revision returns a conflict. A rejected version requires a nonblank reason. A review never implicitly edits content.

Only the current approved version of an active article appears in `kb_approved_articles`. A new draft immediately removes eligibility, even if an older version was approved. Archiving removes eligibility and prevents further changes, while preserving history and audits. The UI disables submission while unsaved changes are displayed. Historical versions never become eligible by being listed in history.

**Future retrieval code must use this approved-only boundary through an application service**, never the staff CRUD endpoints or base tables. No retrieval service or AI database access is implemented here. Do not grant an AI model database credentials.

## REST API

All routes below require `Authorization: Bearer <accessToken>` and are relative to `/api/knowledge-base`.

| Method | Route                    | Request / result                                                            |
| ------ | ------------------------ | --------------------------------------------------------------------------- |
| GET    | `/categories`            | Paginated category list; optional `q`                                       |
| GET    | `/categories/:id`        | One category                                                                |
| POST   | `/categories`            | Admin: `{ name, description? }`; returns 201                                |
| PATCH  | `/categories/:id`        | Admin: `{ name, description?, expectedRevision }`                           |
| DELETE | `/categories/:id`        | Admin: JSON `{ expectedRevision }`; 204; referenced categories return 409   |
| GET    | `/articles`              | Paginated current versions; optional `q`, `categoryId`, `status`, `archive` |
| GET    | `/articles/:id`          | Current article, including archived articles                                |
| POST   | `/articles`              | `{ categoryId, title, body, language }`; creates draft v1; 201              |
| PATCH  | `/articles/:id`          | Full article payload plus `expectedRevision`; creates a new draft version   |
| DELETE | `/articles/:id`          | Admin: JSON `{ expectedRevision }`; archives, 204                           |
| POST   | `/articles/:id/submit`   | `{ expectedRevision }`; draft → pending, 200                                |
| POST   | `/articles/:id/review`   | Admin: `{ expectedRevision, decision: "approve"                             | "reject", note? }`; 200 |
| GET    | `/articles/:id/versions` | Paginated immutable content history, newest version first                   |
| GET    | `/audit-records`         | Admin; paginated records, optional `entityId`                               |

List responses are `{ items, total, page, limit }`. `page` defaults to 1 (range 1–10,000), `limit` to 20 (range 1–50). Article lists are ordered by last change and UUID; history by version; audit by timestamp and UUID. Empty pages retain the actual total. Article `status` accepts `draft`, `pending`, `approved`, `rejected`; `archive` accepts `active` (default), `archived`, `all`. Search length is at most 100 characters.

Body limits: name 100, description 500, title 200, article body 10,000, review note 1,000 characters. Titles/names/bodies cannot be blank or contain NUL. Language is `my` or `en`. API JSON limit is 64 KB. Unknown fields (including client-supplied status/actor/approval metadata), invalid UUIDs, and malformed pagination are rejected. Text is rendered as plain React text, never injected HTML.

Status codes: 400 validation/invalid rejection reason; 401 missing or expired authentication; 403 insufficient role/ownership; 404 unknown entity; 409 stale revision, invalid transition, duplicate name or referenced category; 429 rate limit; 503 unavailable database/migrations. Reload before retrying a 409 rather than overwriting another user's change.

## Verification

`npm run check` runs lint, compilation, unit/API tests, and UI tests. `npm run test:db` runs real PostgreSQL tests with unique disposable `kb_test_<uuid>` schemas. Cleanup drops only the generated schema; it never truncates application tables or changes volumes. Tests verify concurrent migrations/edits, checksum validation, persistence after app restart, Burmese text, role boundaries, literal search, approved-only eligibility, immutable history, and atomic audit failures. Use a synthetic development database only.

Locking reference: [PostgreSQL 17 explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html).
