# Analytics Operations Record - 2026-07-09

## Purpose

This record captures the analytics operations hardening work applied after the v2 analytics schema rollout.

## Applied Scope

- Added administrator dashboard health visibility backed by `/api/analytics/health`.
- Added dashboard empty states and mobile navigation for operational scanning.
- Added reusable dashboard health/data-quality helpers and tests.
- Added `analytics:profile` maintenance command for read-only data quality review.
- Added a manual `Analytics Maintenance` GitHub Actions workflow for production `migrate`, `backfill`, `scrub-ip`, `profile`, and `retention` runs.
- Extended the admin analytics smoke test to cover the health API fixture and mobile overflow checks.

## Production Data Review Before Backfill

Read-only production profiling on 2026-07-08 showed:

- Total events: `2,996`
- Last event: `2026-07-08 14:00:24 UTC`
- Last 24 hours: `58` events, `10` pageviews
- Missing `visitor_key`: `2,948`
- Missing `ip_hash`: `2,948`
- Missing `event_date_kst`: `2,948`
- Missing `referrer_host` where referrer existed: `96`
- Duplicate `event_id` rows: `0`

## Required Operational Follow-Up

Run the maintenance script in production after deployment:

```bash
gh workflow run "Analytics Maintenance" --ref main -f mode=backfill
gh workflow run "Analytics Maintenance" --ref main -f mode=scrub-ip
gh workflow run "Analytics Maintenance" --ref main -f mode=profile

# Equivalent server-side command:
docker compose -f docker-compose.server.yml exec -T frontend node scripts/analytics-maintenance.mjs backfill
docker compose -f docker-compose.server.yml exec -T frontend node scripts/analytics-maintenance.mjs scrub-ip
docker compose -f docker-compose.server.yml exec -T frontend node scripts/analytics-maintenance.mjs profile
```

Expected result:

- `missing_visitor_key`, `missing_ip_hash`, and `missing_event_date_kst` should drop to `0`.
- `duplicate_event_ids` should remain `0`.
- `raw_ip_rows` only counts values that are neither `redacted` nor `unknown`.

## Production Backfill Result

The production `Analytics Maintenance` workflow was executed after deployment:

- Backfill run: `2,948` legacy event rows updated.
- Profile after backfill:
  - Total events: `3,005`
  - Last event: `2026-07-08 16:47:10 UTC`
  - Last 24 hours: `67` events
  - Missing `visitor_key`: `0`
  - Missing `ip_hash`: `0`
  - Missing `event_date_kst`: `0`
  - Missing `referrer_host`: `0`
  - Duplicate `event_id` rows: `0`

The maintenance profile now separates real-looking raw IP values from the `redacted` placeholder used by the current collection path.

The follow-up `scrub-ip` mode redacts legacy `analytics_events.ip` values only after `visitor_key`, `ip_hash`, and `event_date_kst` are present, so the compatibility column remains while operational stats continue to use hashed visitor keys.

## Production Scrub Result

The production `scrub-ip` run was executed after the mode was deployed:

- Scrub run: `2,948` event rows and `458` session rows redacted.
- Profile after scrub:
  - Total events: `3,005`
  - Missing `visitor_key`: `0`
  - Missing `ip_hash`: `0`
  - Missing `event_date_kst`: `0`
  - Missing `referrer_host`: `0`
  - Raw IP rows: `0`
  - Redacted IP rows: `3,005`
  - Duplicate `event_id` rows: `0`
  - Finding: low severity, no immediate core quality issue found.

## Notes

- Clip automation remained disabled during the production check: `CLIP_AUTO_COLLECT_ENABLED=false`.
- Backend health reported Selenium available and `49` shared clips.
- Uptime Monitor completed successfully after deployment verification.
