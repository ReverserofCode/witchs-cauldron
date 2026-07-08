# Analytics Operations Record - 2026-07-09

## Purpose

This record captures the analytics operations hardening work applied after the v2 analytics schema rollout.

## Applied Scope

- Added administrator dashboard health visibility backed by `/api/analytics/health`.
- Added dashboard empty states and mobile navigation for operational scanning.
- Added reusable dashboard health/data-quality helpers and tests.
- Added `analytics:profile` maintenance command for read-only data quality review.
- Added a manual `Analytics Maintenance` GitHub Actions workflow for production `migrate`, `backfill`, `profile`, and `retention` runs.
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
gh workflow run "Analytics Maintenance" --ref main -f mode=profile

# Equivalent server-side command:
docker compose -f docker-compose.server.yml exec -T frontend node scripts/analytics-maintenance.mjs backfill
docker compose -f docker-compose.server.yml exec -T frontend node scripts/analytics-maintenance.mjs profile
```

Expected result:

- `missing_visitor_key`, `missing_ip_hash`, and `missing_event_date_kst` should drop to `0`.
- `duplicate_event_ids` should remain `0`.
- `raw_ip_rows` can remain non-zero for legacy compatibility because the `ip` column is retained.

## Notes

- Clip automation remained disabled during the production check: `CLIP_AUTO_COLLECT_ENABLED=false`.
- Backend health reported Selenium available and `49` shared clips.
- Uptime Monitor completed successfully after deployment verification.
