# Fanart permission publishing implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and test the approved administrator-mediated permission workflow, without deploying or contacting creators.
**Architecture:** A dedicated PostgreSQL catalog and private persistent image volume feed uncached public routes. Explicit creator permission and operator review gate upload/publication; existing static artworks remain separately identified legacy entries.
**Tech Stack:** Existing Next.js 16.3, React 19, TypeScript, pg, sharp, Vitest, Playwright, PostgreSQL 16. No production dependencies added.
**Spec:** `docs/superpowers/specs/2026-09-15-fanart-permission-workflow-design.md` (approved by user on 2026-09-18).

## Global Constraints

- No deployment, scraping, message sending, or real artist image use during tests.
- JSON body 32 KiB; multipart body 11 MiB; image file 10 MiB; maximum 20,000,000 input pixels; PNG/JPEG/WebP single-frame only; output WebP maximum 1600px long edge without enlargement, maximum 5 MiB.
- Every admin API independently authenticates using existing ADMIN_BASIC_AUTH_USERNAME/PASSWORD. Missing credentials disable new APIs even in development. Mutations require exact configured FANART_ALLOWED_ORIGIN, never a Host-derived origin.
- Asset path FANART_ASSETS_DIR defaults to frontend/.data/fanart for local development; production /app/data/fanart on fanart_assets volume. Never store new images in public or Git.
- Public fields only: id, src, alt, credit, sourceUrl, publishedAt. No download endpoint. Every image request rechecks publication and approval hash. All new API/media responses no-store.
- Terminal withdrawn/rejected records retain source uniqueness. Existing static files are not automatically approved or removed.
- New work uses current isolated branch. Preserve unrelated work. Never spawn worker-owned reviewers or subagents.

## Shared contract

Domain: `frontend/app/lib/fanart/model.ts` exports FanArtWork, FanArtImage, ReviewInput, FanArtError, normalizeSourceUrl, createCandidate, applyReview, attachAsset, publishWork, withdrawWork, rejectWork, publicImage, permissionRequest. All pure operations accept explicit ISO timestamp where needed.

FanArtWork uses camelCase: id, sourceUrl, sourceKey, title, credit, status, version, createdAt, updatedAt, publishedAt, withdrawnAt, requestedAt, permission ({display,resize,credit,confirmedAt,evidence}), review ({status,confirmedAt,note}), asset ({key,sha256,bytes,width,height}|null), approvedHash (string|null). States candidate/requested/ready/published/withdrawn/rejected. Review states pending/confirmed_non_generative/unclear/excluded_generative.

Repository `frontend/app/lib/fanart/repository.ts` exports createFanArtRepository(pool: Pool) and getFanArtRepository(). Methods: create(input), list({status?,offset?,limit?}), get(id), update(id,version,operation), published(), audit(id). update acquires row lock, applies domain operation and saves audit event atomically. Pool from FANART_DATABASE_URL or existing configured analytics DB connection. Dependency injection allows real dedicated PostgreSQL integration tests. Use separate fanart tables, no analytics schema mutation.

REST responses: list `{works, hasMore}`; detail/create/mutations `{work, events?}`; public `{images}`; errors `{error: string}`. PATCH detail accepts `{version, review: ReviewInput}`; ReviewInput includes permission, review, requested boolean. Source/title/credit immutable after creation in MVP (fixing metadata requires rejecting and a later repermission feature; disclose in UI). Actions `{version}` for publish/withdraw/reject. Asset multipart includes `version` and `file`. All versions positive integers. Add POST `/api/admin/fanart/[id]/reject` to implement terminal rejection described in spec.

### Task 1: Domain, transactional catalog and guarded HTTP workflow

**Ownership:** New `frontend/app/lib/fanart/{model,repository,assets,http,handlers}.ts` and corresponding tests; new `/app/api/admin/fanart/**`, `/app/api/fanart/route.ts`, `/app/media/fanart/[id]/route.ts`; proxy matcher. Do not change UI or Compose.

**Interfaces:** Produces shared contract above for Task 2. Read approved spec in full. Report any concrete contradiction before implementing.

- [ ] Write failing domain tests: reject missing permission/review/file; canonical URLs deduplicate; terminal records cannot publish; asset replacement resets verification and cannot inherit prior approval; public projection contains no private fields. Example:

```ts
const work = createCandidate({sourceUrl:'https://cafe.naver.com/moinge/123?x=1', title:'작품',credit:'작가'}, '2026-09-18T00:00:00.000Z');
expect(work.sourceKey).toBe('30182989:123');
expect(() => publishWork(work, '2026-09-18T01:00:00.000Z')).toThrow();
expect(permissionRequest(work)).toContain('https://moingfans.com');
```

- [ ] Run `npm test -- app/lib/fanart/model.test.ts` and record RED. Implement pure domain transitions. First upload requires permission/review confirmed. Replacing asset clears review confirmation so a fresh explicit review is required before publication. Changing permission/review resets approvedHash; published and terminal records cannot be edited/uploaded. Publication binds approvedHash to asset.sha256. Repeating already-successful publish/withdraw returns current result; stale conflicting updates are 409.

- [ ] Write storage integration tests against FANART_TEST_DATABASE_URL only, isolated schema per test run. Never touch a default or remote production DB in tests. Create two repository instances to test concurrent update conflict and repeated publication. Example:

```ts
const outcomes = await Promise.allSettled([
  repository.update(work.id, work.version, current => applyReview(current, input, now)),
  repository.update(work.id, work.version, current => applyReview(current, input, now)),
]);
expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
```

- [ ] Implement dedicated tables with UUID id, unique source_key, indexed status/publication time, version and JSONB record, plus transactionally-written audit events. Avoid long image processing inside row lock. Never log evidence or DB credentials. Schema initialization retry after failure and concurrent creation protected with advisory transaction lock.

- [ ] Write HTTP/asset tests before code. Real Request/Response and sharp-generated test shapes; bound the stream regardless of Content-Length; invalid auth/origin cannot reach repository; SVG/disguised/GIF/oversize rejected; published projection redacted; media returns 404 after withdrawal and 503 on DB outage. Tests may inject storage at network boundary but domain must be real.

```ts
const badOrigin = new Request('http://localhost/api/admin/fanart', {
  method:'POST', headers:{origin:'https://attacker.invalid',authorization:validBasic}, body:'{}',
});
expect((await handlers.create(badOrigin)).status).toBe(403);
```

- [ ] Implement auth via timing-safe comparison of fixed-length credential hashes; no development bypass. Stream cap before JSON/formData parse; validate IDs and all input scalar types/lengths. API error wrapper maps FanArtError to safe status/message, unknown errors to generic 503. Multipart cannot supply a server path. Re-encode to WebP, drop metadata, generated UUID key, fs write exclusive, no remote fetching. Asset file must exist before DB attachment; delete newly-created orphan on attachment failure only. Do not remove unrelated files.
- [ ] Thin Node runtime routes await params and delegate to handlers. Media uses no-store/nosniff and checks current publication/hash on every request; verify saved file hash before response. Do not opt into Next image cache. Add proxy matcher while preserving unrelated auth behavior.
- [ ] GREEN: focused tests then full `npm test`, `npm run typecheck`; self-review and commit only owned paths. Report actual skipped integrations separately with RED/GREEN evidence.

### Task 2: Admin UI, live gallery and durable deployment configuration

**Ownership:** `frontend/app/admin/fanart/**`; gallery/modal/shared type integration; new gallery hook and browser test; `frontend/app/lib/fanart.ts`; Compose files, Dockerfile, next image config if necessary, .gitignore, sample environment documentation and `docs/FANART_PERMISSION_WORKFLOW.md`. Do not rewrite Task 1 backend without reporting need.

**Interfaces:** Consume Task 1 REST/model contract, confirmed from Task 1 report before edits. Legacy loader remains synchronous; new API polled client-side. New type supports optional id/sourceUrl/publishedAt alongside legacy src/alt/credit/download.

- [ ] Write browser smoke script with assertions before UI (Playwright package already installed). Use dedicated local test app/DB and own generated image; no real café contents. Assert unauthorized API blocked; candidate cannot publish; fill permission and review; upload, publish, find artist/source in gallery, withdraw, media404 and gallery removal.
- [ ] Run script against existing UI to observe missing admin workflow failure. Implement admin list/status filter/pagination/detail, editable evidence/review fields, request text copy and explicitly recorded request, upload and publish controls, rejection and named confirmation of withdrawal. Show API errors, stale version refresh prompt, private evidence warning, no automated sending claims. Use labels/accessibility and existing styles. Disable actions during in-flight operation; only reset state on successful response.
- [ ] Create one shared client catalog subscription used by both galleries: initial load, focus and visible interval 60 seconds, pause when hidden, deduplicate overlapping fetches; preserve previous approved list on failure. Fetch no-store, validate public result. Merge legacy entries separately and label only records from published API as reviewed. Use current src/id selection with safe fallback when an item is removed, close empty modal.
- [ ] Every newly-managed image in gallery/modal/thumbnails uses unoptimized, not just the main image. Block `/media/fanart/**` from next/image optimizer via localPatterns exclusion or request guard, so manually crafted `/_next/image?url=/media/fanart/...` cannot outlive withdrawal. Preserve legacy/local image optimization.
- [ ] Add source link, KST introduction date, verification label for new images; keep existing legacy image behavior and revise empty copy. Shared type exports preserve existing imports.
- [ ] Configure fanart_assets volume and FANART_ASSETS_DIR/FANART_ALLOWED_ORIGIN in dev/prod/server Compose. Ensure nonroot Docker runner owns mount initialization directory and retains files after recreate. Ignore frontend/.data. Document FANART_DATABASE_URL optional (same existing PG allowed), admin envs, backups, rollback, legacy limitations, no scrape/auto-send, no deployment performed.
- [ ] GREEN: browser smoke, full tests/typecheck/lint/build; no hidden skipped browser claim. Commit owned paths and full test evidence report.

## Release verification (controller)

- [ ] Read task reports and review diffs independently; fix Important/Critical findings before completion.
- [ ] Run unit/integration tests, typecheck, lint, production build, local browser smoke with self-made image.
- [ ] Try Docker build/recreate with dedicated test services/volumes only. If unavailable, record that limitation instead of using production infrastructure.
- [ ] Document results and requirements for future deployment. Keep this feature branch local; no push/merge/deploy requested.
