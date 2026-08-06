# 2026-08-06 Deployment Record Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the complete 2026-08-06 production deployment, its SSH fingerprint failure and recovery, final verification evidence, and remaining operational cautions.

**Architecture:** Keep immutable, execution-specific evidence in a new dated record under `docs/`. Keep README concise by adding only a discoverable link and current operational cautions. Treat the approved design spec and the successful GitHub Actions run as the sources of truth.

**Tech Stack:** Markdown, Git, PowerShell, GitHub Actions run metadata

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-06-deployment-record-documentation-design.md` exactly.
- Do not change application code, Docker Compose, GitHub Actions workflows, or production configuration.
- Do not include passwords, API keys, Basic Auth values, secret values, or the literal SSH fingerprint.
- Record public audit identifiers exactly: commit `61540545527a5edff73610cea45ecb03e578c846`, CD run `31046763294`, successful attempt `2`.
- Distinguish the first pre-deployment handshake failure from the successful second attempt and state that rollback was prepared but not executed.
- Do not push or redeploy as part of this documentation task.

---

### Task 1: Write the dated production deployment record

**Files:**
- Create: `docs/DEPLOYMENT_RECORD_2026-08-06.md`
- Reference: `docs/superpowers/specs/2026-08-06-deployment-record-documentation-design.md`

**Interfaces:**
- Consumes: approved documentation design, commit `6154054`, CD run `31046763294`, and the verified production smoke-test results.
- Produces: a standalone chronological record that README can link to without duplicating the full incident narrative.

- [ ] **Step 1: Confirm the record does not already exist**

Run:

```powershell
if (Test-Path -LiteralPath docs/DEPLOYMENT_RECORD_2026-08-06.md) { throw "record already exists" }
```

Expected: exit code `0` with no output.

- [ ] **Step 2: Create the deployment record with exact evidence**

Create `docs/DEPLOYMENT_RECORD_2026-08-06.md` with these sections and facts:

```markdown
# Production Deployment Record - 2026-08-06

## Summary
- Target commit: full SHA `61540545527a5edff73610cea45ecb03e578c846`
- GitHub Actions run: linked run `31046763294`
- Final result: attempt 2 succeeded; build-and-test and deploy jobs succeeded

## Scope Included
- Broadcast catch-up hub, Next.js 16/React 19 modernization, secure clip streaming, Analytics improvements, workflow hardening, and documentation updates

## Pre-Deployment Verification
- 17 test files and 85 tests passed
- TypeScript passed
- ESLint reported 0 errors and 22 non-blocking warnings
- Next.js production build and Docker runtime smoke passed
- npm audit reported 0 vulnerabilities

## GitHub Deployment Configuration
- production environment created with a custom main-only deployment branch policy
- SSH_HOST_FINGERPRINT stored as an environment secret without documenting its value
- no required reviewer is currently configured

## Deployment Timeline
- local and remote main divergence check
- push of commit 6154054
- attempt 1 build success and SSH host key fingerprint mismatch before application replacement
- comparison of ED25519, ECDSA P-256, and RSA host keys
- confirmation that drone-ssh 1.8.2 selected ECDSA P-256 before ED25519
- environment secret correction and failed-job rerun
- attempt 2 checkout, image snapshot, clean build, replacement, health checks, and Analytics verification

## Root Cause and Resolution
- the first stored fingerprint was valid for ED25519 but did not match the ECDSA key selected by the Go SSH client
- the matching ECDSA P-256 SHA256 fingerprint was stored; no password or key material was recorded

## Final Deployment Result
- server checked out 6154054
- frontend and backend health checks passed
- authenticated Analytics stats verification passed
- primary deploy step succeeded, retry step was skipped, and rollback was not executed

## Post-Deployment Smoke Results
- homepage 200
- /api/health 200 with ok=true
- /broadcasts 200 with 30 broadcasts and no fallback or partial-data warning
- clip catalog 200 with 10 clips and conditional ETag request 304
- clip HEAD 200 and Range request 206 with exact byte range
- sitemap 200 with homepage and broadcasts entries
- unauthenticated admin analytics 401 with Basic challenge and noindex headers

## Operational Notes and Follow-Up
- main pushes currently deploy automatically without a PR or required reviewer gate
- adding a production required reviewer would also gate scheduled recovery and maintenance workflows
- COLLECT_API_KEY and CLIP_REFRESH_API_KEY are absent from GitHub; the existing server .env value was preserved
- /api/health proves frontend liveness, while the CD health check and Analytics verification cover additional dependencies
- no secret values appear in the record

## Reproduction Commands
- gh run view commands that use only the public run ID and repository name
- curl commands for health, broadcasts, catalog, Range, sitemap, and unauthenticated admin checks
```

Use Korean prose for the final record while retaining endpoint names, command names, and exact public identifiers in code formatting.

- [ ] **Step 3: Verify completeness and secret hygiene**

Run:

```powershell
$record = Get-Content -Raw -LiteralPath docs/DEPLOYMENT_RECORD_2026-08-06.md
$required = @(
  '61540545527a5edff73610cea45ecb03e578c846',
  '31046763294',
  'attempt 2',
  'fingerprint mismatch',
  '85',
  '206',
  '401',
  'COLLECT_API_KEY'
)
$missing = @($required | Where-Object { $record -notmatch [regex]::Escape($_) })
if ($missing.Count -gt 0) { throw "missing evidence: $($missing -join ', ')" }

$sensitive = @(Select-String -LiteralPath docs/DEPLOYMENT_RECORD_2026-08-06.md -Pattern 'github_pat_|SHA256:[A-Za-z0-9+/=]{20,}|password\s*[:=]\s*\S+')
if ($sensitive.Count -gt 0) { throw "possible secret material found" }
```

Expected: exit code `0` with no output.

- [ ] **Step 4: Commit the standalone record**

```bash
git add docs/DEPLOYMENT_RECORD_2026-08-06.md
git commit -m "Document 2026-08-06 production deployment"
```

Expected: one commit containing only the dated deployment record.

---

### Task 2: Link the record from README and document current cautions

**Files:**
- Modify: `README.md` in the `배포 가이드` section
- Reference: `docs/DEPLOYMENT_RECORD_2026-08-06.md`

**Interfaces:**
- Consumes: the dated record created in Task 1.
- Produces: a stable README entry point that does not duplicate the complete timeline.

- [ ] **Step 1: Add a recent deployment record subsection**

Immediately after `## 배포 가이드`, add a `### 최근 운영 배포 기록` subsection containing:

```markdown
- [2026-08-06 운영 배포 기록](docs/DEPLOYMENT_RECORD_2026-08-06.md) — 커밋 `6154054`, GitHub Actions CD run `31046763294`
- 현재 `production` environment는 `main` 배포만 허용하며 required reviewer는 설정하지 않았다. 따라서 `main` 직접 push는 검증 후 자동 배포된다.
- GitHub의 `COLLECT_API_KEY` / `CLIP_REFRESH_API_KEY`는 미설정 상태이며, 2026-08-06 배포에서는 서버의 기존 `.env` 값을 보존했다.
```

Do not copy the incident timeline or any secret value into README.

- [ ] **Step 2: Verify the README link and scope**

Run:

```powershell
$readme = Get-Content -Raw -LiteralPath README.md
if ($readme -notmatch '\[2026-08-06 운영 배포 기록\]\(docs/DEPLOYMENT_RECORD_2026-08-06\.md\)') { throw "README link missing" }
if (-not (Test-Path -LiteralPath docs/DEPLOYMENT_RECORD_2026-08-06.md)) { throw "linked record missing" }

$changed = @(git diff --name-only)
$allowed = @('README.md', 'docs/DEPLOYMENT_RECORD_2026-08-06.md', 'docs/superpowers/plans/2026-08-06-deployment-record-documentation.md')
$unexpected = @($changed | Where-Object { $_ -notin $allowed })
if ($unexpected.Count -gt 0) { throw "unexpected files: $($unexpected -join ', ')" }
```

Expected: exit code `0` with no output.

- [ ] **Step 3: Run final documentation checks**

Run:

```powershell
$files = @(
  'README.md',
  'docs/DEPLOYMENT_RECORD_2026-08-06.md',
  'docs/superpowers/plans/2026-08-06-deployment-record-documentation.md'
)
$placeholderTerms = @('T' + 'BD', 'T' + 'ODO', 'FIX' + 'ME')
$placeholders = @($placeholderTerms | ForEach-Object {
  Select-String -LiteralPath $files -SimpleMatch -Pattern $_
})
if ($placeholders.Count -gt 0) { throw "placeholder found" }

git diff --check
```

Expected: placeholder count `0` and `git diff --check` exit code `0`.

- [ ] **Step 4: Commit the README connection**

```bash
git add README.md
git commit -m "Link production deployment record"
```

Expected: a documentation-only commit containing only README.
