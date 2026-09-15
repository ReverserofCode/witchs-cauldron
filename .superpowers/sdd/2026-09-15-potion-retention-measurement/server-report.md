# Potion pilot server implementation report

## Scope and interfaces

- `potion-contract.ts`: exact-key payload validation; canonical lowercase UUIDs; `PotionPilotEvent`, `AcceptedEvent`, and analytics-local mode/rule types.
- `potion-config.ts`: `POTION_PILOT_WINDOW` remains `null`; first-party origin is `https://moingfans.com`.
- `potion-db.ts`: dedicated explicit-target PostgreSQL pool (`max: 3`, 3-second connect timeout), isolated schema, retryable pool/schema initialization, transactional/idempotent ingestion, fixed 45-day participant expiry.
- `POST /api/analytics/potion/track`: disabled-pilot short circuit, first-party origin enforcement, streamed 2 KiB limit, validation, generic `503`, and `no-store` responses.
- `potion-summary.ts`: strict inclusive cohort ranges up to 45 days, D1-D7 maturity/return aggregation, D0 replay, mode starts, and observed 24-hour completion.
- `GET /admin/analytics/potion-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`: protected by the existing `/admin/:path*` proxy matcher; returns `400`, `200`, or generic `503` with private no-store caching.

## TDD and verification evidence

- RED `npm test -- app/lib/analytics/potion-contract.test.ts`: failed because `potion-contract` did not exist.
- RED `npm test -- app/lib/analytics/potion-db.test.ts app/api/analytics/potion/track/route.test.ts`: failed because the DB module/route did not exist.
- RED boundary mutation `npm test -- app/lib/analytics/potion-db.test.ts`: failed at exact `observeUntilMs` because the implementation attempted to connect; changed observation/enrollment windows to half-open intervals.
- GREEN `npm test -- app/lib/analytics/potion-contract.test.ts app/lib/analytics/potion-db.test.ts app/lib/analytics/potion-summary.test.ts app/api/analytics/potion/track/route.test.ts`: 4 files passed, 17 tests passed, 12 PostgreSQL cases skipped.
- GREEN scoped ESLint over all ten owned source/test files: exit 0, no findings.
- `npx tsc --noEmit --pretty false` reached only concurrent-task errors outside this server scope: missing `potion-client.ts` and a non-exported game `RecordSummary`; no server-owned TypeScript diagnostics.

## PostgreSQL coverage and remaining verification

The real integration suite refuses unsafe targets and runs only when `POTION_TEST_DATABASE_URL` names the loopback database `potion_test`. It covers schema constraints/indexes, fail-closed pool recovery, first enrollment, immutable first timestamps/expiry, enrollment and 45-day boundaries, start/complete matching, event/run/day idempotency, conflict rollback, concurrent first-start retries, and cohort/completion fixtures. No safe local PostgreSQL was available because Docker Desktop could not start, so these 12 cases were skipped locally and must run in CI with a disposable PostgreSQL 16 service and one worker.

The source pilot window is intentionally null, so production ingestion returns `204` before origin, body, schema, or pool work. Activation, production smoke authentication, and final aggregate archival remain outside this scoped server implementation.
