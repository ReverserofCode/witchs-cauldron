# Fanart Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registered cafe candidates receive a single permission-request comment, their replies enter administrator review, and verified files are prepared and published after human confirmation.

**Architecture:** Reuse existing FanArtWork JSON records and optimistic PostgreSQL transactions for durable outreach state; do not introduce a second database or a background timer inside Next request handlers. A separate TypeScript CLI process uses a configurable visible-browser provider. Keep browser provider, domain/service orchestration, authenticated administrator UI and operator setup separate.

**Tech Stack:** Existing Next.js, TypeScript, pg, sharp, Vitest and Playwright. Add tsx as a locked development/runtime-tool dependency only if needed to run a standalone source worker; no SaaS, AI decision service, or external messages during testing.

**Spec:** `docs/superpowers/specs/2026-09-18-fanart-permission-automation-design.md`, including the user's execution-scope amendment.

## Global Constraints

- Cafe 30182989, fanart board 38 only; registered candidates only; one initial request per original article; no reminders.
- No actual production requests that write data, no real cafe comments, no scraping credentials, no CAPTCHA or login restriction bypass during implementation/testing.
- Human confirms permission and non-generative creation; no text classifier grants consent. After that, privately prepare one image and require human review of the exact prepared bytes before automatic publication.
- Existing Basic Auth, mutation Origin guards, fail-closed database, public six-field shape, no-store, hash verification, withdrawal and legacy fanart remain intact.
- Input image 10 MiB/20 million pixels; output WebP at most 1600px long side and 5 MiB. No download before recorded permission.
- External comment writes default disabled and require explicit opt-in, positive limits, configured account identity and queued candidates. Ambiguous remote sends are never blindly retried.
- Browser selectors are operator configuration, not claimed verified against the authenticated production cafe. Login is manual in a dedicated profile; no cookie export from other browsers.
- User clarification: every live inspection, reply poll, preparation and publication step requires the configured Naver operator to be signed in. Missing/expired/mismatched identity fails closed. Offline administrator review/queueing does not itself send or publish anything; login mode only opens a manual login session.

## Provider interface shared across tasks

The controller owns `frontend/scripts/fanart-browser/provider.mjs` and its tests (Task 2). Task 1 consumes the following contract without modifying those files:

```ts
interface CafeImage { id: string; url: string }
interface CafeComment { id: string; parentId: string | null; authorId: string; text: string }
interface CafeSnapshot {
  sourceUrl: string; title: string; authorId: string; boardId: string;
  images: CafeImage[]; comments: CafeComment[]; fingerprint: string;
}
interface CafeProvider {
  inspect(sourceUrl: string): Promise<CafeSnapshot>;
  sendRequest(sourceUrl: string, text: string, marker: string): Promise<{commentId: string}>;
}
// module export (selectors schema is documented with Task 2):
// createCafeBrowserProvider({ page, selectors, operatorMemberKey }) => CafeProvider
```

## Task 1: Durable workflow, administrator controls and source worker

**Ownership:** `frontend/app/lib/fanart/outreach*.ts`, a small new `outreach/` directory if needed for separation; `model.ts` optional outreach field; `repository.ts` audit extensions if needed; `handlers.ts` reuse/extraction; new authenticated API routes under `/api/admin/fanart/[id]/outreach`; administrator `OutreachPanel.tsx` and insertion into `FanArtAdmin.tsx`; `frontend/scripts/fanart-outreach.ts`; package scripts/locked tsx tool dependency. Do not edit provider.mjs, its tests, workflows, Compose, or production configuration.

**Interfaces consumed:** existing `FanArtRepository`, `FanArtAssetStore`, model review/upload/publish checks and the provider contract above. Repository update uses synchronous pure operations and transaction-based version checks. JSON can carry optional `outreach` state, but publicImage must still expose only existing public fields.

**Interfaces produced:** documented `createOutreachService({repository,assets,provider,downloadImage,now})`, administrator operations and `tick`/single-work processing callable by CLI. Keep exact interface exported in a dedicated module and report it to controller. Tests may inject a deterministic mock external provider; real model/repository behavior must not be mocked away.

- [ ] Write failing behavioral tests for: enqueue once, other board rejected, explicit AI-tagged title excluded, missing author rejected, no reply implies no consent, unrelated author not approval evidence, only response to our comment can support a decision, changed reply invalidates pending approval, cancelled/rejected work never sends/posts, send timeout moves to uncertain and cannot resend, concurrency grants send to one worker.

Example consumer-level assertions (adapt construction to the service API you export):
```ts
await service.enqueue(work.id, work.version);
await service.tick(work.id, { allowComments: false });
expect((await repository.get(work.id))!.outreach!.status).toBe('queued');
await service.tick(work.id, { allowComments: true });
await service.tick(work.id, { allowComments: true });
expect(remote.comments.filter(c => c.authorId === 'operator')).toHaveLength(1);
expect((await repository.get(work.id))!.permission.display).toBe(false);
```

- [ ] Run `npm test -- app/lib/fanart/outreach.test.ts`; record RED before implementing. Build a typed pure domain/state service and keep individual modules focused. Persist a send claim BEFORE the browser action; a crash/unknown send is held, not retried. Catch version conflicts without returning success. Worker owns no admin credentials.
- [ ] Add an authenticated handler using existing authentication and Origin helpers. Administrator actions: queue request, cancel before sending, inspect collected replies, select exact author reply and image, confirm permission/non-AI review, prepare image, show protected prepared-image preview, approve exact prepared hash for posting, reject. Never auto-approve from reply keywords. Existing manual flows remain usable; worker must recheck current work state/version before each mutation and public commit.
- [ ] Secure image downloader: only HTTPS known exact Naver image hosts, no credentials, reject redirects, bounded stream/time, private/local addresses denied and DNS checked/pinned during connection; do not pass browser cookies or admin headers to image hosts. If original URL or reply changes after confirmation, stop preparation/publication for human re-review. Approval binds reply digest, original fingerprint and actual prepared file hash.
- [ ] Final approval and published state can be committed in one version-checked repository update after verifying file bytes; do not create a permanently stranded 'approved but not enqueued' state. Keep existing public route compatible. Authentication/Origin/error tests and prepared-image unauthorized tests required.
- [ ] CLI commands: manual login session, read-only inspect, one iteration, optional bounded polling. Use dedicated configured profile path, selector JSON, account member key, database and private asset directory from explicit environment. By default do not call sendRequest or mutate works on a dry run. Comment mode needs `--send-comments`, positive per-run limit at most 5 and sequential processing; require database advisory lock to enforce a single running CLI, persistent per-account daily cap at most 10, minimum 60 seconds between sends. Re-read a stop file before each external write. Support empty candidates safely and fail configuration before browser launch.
- [ ] Run unit tests plus real loopback PostgreSQL integration using existing test-schema isolation convention (`FANART_TEST_DATABASE_URL` must target localhost/fanart_test). Test approval/save races, durable send claim and restart without duplicate send, rejected/withdrawn data unchanged, public response private-field exclusion. Test image limits and DNS/redirect rejection without Internet writes.
- [ ] Integrate UI status/error handling and exact-byte preview; run typecheck and scoped ESLint. Read installed Next route docs before changing routes. Commit ONLY owned files, write report with RED/GREEN evidence, interfaces, remaining real-account setup, and no live-verification claims.

## Task 2: Configurable browser provider and isolated DOM contract tests

**Ownership:** controller writes `frontend/scripts/fanart-browser/provider.mjs`, `provider.d.mts`, `provider.test.ts` and example selector schema/README under the same directory. Module imports only node crypto and consumes a Playwright Page supplied by CLI; no credentials or automatic login.

- [ ] Write a browser fixture test where `page.route` intercepts all requests to the exact cafe URL and supplies a local HTML article. Verify inspect returns only this article's content, and send fills the intended comment textarea and clicks one submit button. Test missing author, wrong board, ambiguous textarea/button, disabled/expired login, duplicate marker, incomplete comment list, pending captcha and missing post-send confirmation. Route all other network to abort.
```ts
const snapshot = await provider.inspect('https://cafe.naver.com/moinge/10374');
expect(snapshot.authorId).toBe('artist-key');
await provider.sendRequest(snapshot.sourceUrl, 'permission request', '[moingfans:test]');
await provider.sendRequest(snapshot.sourceUrl, 'permission request', '[moingfans:test]');
expect((await provider.inspect(snapshot.sourceUrl)).comments).toHaveLength(1);
```
- [ ] Run RED. Implement selector configuration with article scope/optional iframe, author/member link, board link, image elements, complete-comments sentinel, comment row ID/parent ID/author/text, signed-in member link, comment textarea and submit button. All must be explicit. Derive author IDs from same-cafe member URLs; do not use display names. Derive board=38 from a configured board link's URL query. Images use HTTPS approved hosts only; fingerprint canonicalizes article title/author/board/image IDs+URLs, not volatile view/like/comment counts.
- [ ] Before sending, inspect and validate signed-in account matches configured member key, comments complete, no duplicate request marker, exactly one input/button and no configured blocker. Add marker to text, perform one click without automatic retry, then inspect resulting DOM without a second submission. Require one matching own comment with stable ID; otherwise throw an uncertain-send error for the durable service. Do not guess authenticated Naver selectors; example fixture values are explicitly non-production.
- [ ] Run GREEN against installed local Chromium. Verify no actual external network/remote writes occurred. Commit owned files. Task review must cover both spec and code quality; final whole-branch review also covers the integration.

## Final verification and handoff

- [ ] Full Vitest, real fanart PostgreSQL tests, typecheck, lint, Next build and browser fixture/administrator flow checks. Keep baseline warnings distinct from new errors.
- [ ] Independent task review and whole-branch review; fix Important/Critical findings before claiming completion.
- [ ] Update spec/operations documentation and verification report with precise supported commands, required account/selector setup, and what was not tested against real cafe. No push/merge/deploy/production commenting in this task.
