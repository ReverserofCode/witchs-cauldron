# Potion Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팬 창작 미니게임 ‘포션 불조절’의 조작·일일 도전·개인 기록을 기존 사이트와 독립적으로 검증 가능한 형태로 만든다.

**Architecture:** 순수 TypeScript 규칙/상태 계층과 React 게임 화면을 분리한다. 서버는 오늘의 규칙과 시각만 제공하고 점수는 브라우저에 저장한다. 분석은 도메인 알림만 소비하는 별도 계획이며 게임의 실행 의존성이 아니다.

**Tech Stack:** 현재 main의 Next.js 16.3.0, React 19.2.5 계열, TypeScript 6.0.3 계열, Tailwind v4, Vitest, Playwright. 구현 시 lockfile 버전을 확인하며 패키지 업그레이드는 하지 않는다.

**Spec:** [포션 불조절 개발 사양](../specs/2026-09-15-potion-timing-design.md), 특히 2–5절·7–8절.

## Global Constraints

- 규칙 버전은 `potion-v1`이다.
- 신규 런타임 의존성을 추가하지 않는다.
- 홈의 `revalidate = 300`을 유지하고 루트 레이아웃을 동적 렌더링으로 변경하지 않는다.
- 모든 게임 진입 링크에 `prefetch={false}`를 적용한다.
- 팬 창작 미니게임이며 모잉의 공식 설정·발언·공식 게임으로 표현하지 않는다.
- 실제 상품 이미지·방송 장면·음성의 신규 수집은 범위에서 제외한다.
- 게임 플레이는 분석 DB·YouTube API 키 없이 가능해야 한다.
- 이번 문서의 체크박스는 **앞으로 실행할 작업**이다. 테스트 성공·구현 완료를 뜻하지 않는다.

## 기준 코드와 파일 지도

검토 기준은 `origin/main@6c01ec057fcd5f93d79c392eca7273396d0ed503`이다. 현재 루트는 이전 커밋 기반이므로 실행 시작 때 최신 main에서 별도 `codex/` 구현 worktree를 만든다. 사용자의 기존 변경은 보존한다. 아래 경로는 그 worktree 루트 기준이다.

| 파일 | 소유 작업 / 책임 |
|---|---|
| NEW `frontend/app/lib/games/potion-timing/types.ts` | T1: 게임 공통 타입/알림 계약 |
| NEW `frontend/app/lib/games/potion-timing/rules.ts`, `rules.test.ts` | T1: 위치·점수·결정적 생성 |
| NEW `frontend/app/lib/games/potion-timing/session.ts`, `session.test.ts` | T1: 순수 상태 전이 |
| NEW `frontend/app/hooks/usePotionTimingGame.ts` | T2: 입력·RAF·중단·알림 연결 |
| NEW `frontend/app/components/games/potion-timing/PotionTimingGame.tsx`, `PotionTimingGame.module.css` | T2: 게임 화면/무음/접근성 |
| NEW `frontend/app/games/potion-timing/page.tsx` | T2/T5: 페이지·metadata·공개 제어 |
| NEW `frontend/app/lib/games/potion-timing/daily.ts`, `daily.test.ts` | T3: 서버 일자/응답 검증 |
| NEW `frontend/app/lib/games/potion-timing/config.ts` | T3/T5: 소스 활성 스위치 |
| NEW `frontend/app/api/games/potion-timing/daily/route.ts`, `route.test.ts` | T3: no-store 일일 API |
| NEW `frontend/app/lib/games/potion-timing/records.ts`, `records.test.ts` | T4: 완료 레코드 검증·저장·집계 |
| NEW `frontend/app/components/games/GameEntryCard.tsx` | T5: 게임 코드와 무관한 홈 카드 |
| MODIFY `frontend/app/page.tsx`, `frontend/app/components/layout/Header.tsx` | T5: 홈/메뉴 진입점 |
| MODIFY `frontend/app/sitemap.ts`, `frontend/app/lib/sitemap.test.ts` | T5: 공개 경로 등록·비활성 제외 |
| NEW `frontend/scripts/smoke-potion-timing.mjs` | T2부터 점진 추가, T6 완성: 실제 브라우저 테스트 |
| MODIFY `frontend/package.json` | T2: smoke:potion 명령만 추가 |
| NEW `docs/POTION_TIMING_GAME.md` | T6: 사용자 규칙·검증·릴리스/중단 운영 문서 |

T3와 T4의 순수 모듈은 T1 이후 병렬 작성 가능하다. T2 UI 파일의 통합은 한 담당자만 수행한다. 공유 파일 담당자는 타인의 수정을 되돌리지 않는다. 측정 계획은 types.ts의 알림 계약만 소비하며 이 파일을 임의로 변경하지 않는다.

## Task 1: 규칙·상태 모델

**Files:** 위 types/rules/session 및 각각의 테스트.

**Interfaces — produces:**

```ts
export type RuleVersion = 'potion-v1';
export type GameMode = 'daily' | 'practice' | 'slow-practice';
export type RoundRule = Readonly<{ center: number; halfWidth: number; periodMs: number }>;
export type Challenge = Readonly<{
  challengeId: string; date: string; rulesVersion: RuleVersion;
  rounds: readonly RoundRule[];
}>;
export type GameActivity = Readonly<{
  kind: 'game_start' | 'game_complete'; runId: string;
  mode: GameMode; rulesVersion: RuleVersion;
}>;
export const POTION_ACTIVITY_EVENT = 'wc:potion-activity:v1';
export type GameState = Readonly<{
  runId: string; mode: GameMode; challenge: Challenge;
  phase: 'ready' | 'running' | 'round-result' | 'paused' | 'finished';
  roundIndex: number; scores: readonly number[];
  startedAtMs: number | null; hasStarted: boolean;
}>;
export type GameCommand = Readonly<{
  type: 'START' | 'STOP' | 'ADVANCE' | 'PAUSE' | 'RESUME';
  runId: string; roundIndex: number; nowMs: number;
}>;
export type Transition = Readonly<{
  state: GameState; activity: GameActivity | null;
}>;
// rules.ts
export function positionAt(elapsedMs: number, periodMs: number): number;
export function scoreAt(position: number, rule: RoundRule): number;
export function makeRounds(seedText: string, slow?: boolean): readonly RoundRule[];
// session.ts
export function createGame(runId: string, mode: GameMode, challenge: Challenge): GameState;
export function transition(state: GameState, command: GameCommand): Transition;
```

- [ ] 위 공통 계약을 types.ts에 정의한다. 사용자에게 보이는 문구는 한국어로 통일한다.
- [ ] 다음 알려진 점수와 입력 중복 사례를 먼저 테스트로 작성한다.

```ts
import { expect, it } from 'vitest';
import { makeRounds, positionAt, scoreAt } from './rules';
import { createGame, transition } from './session';

it('scores known positions independently of render frequency', () => {
  const rule = { center: 50, halfWidth: 10, periodMs: 4000 };
  expect([0, 1000, 2000, 4000].map(t => positionAt(t, 4000)))
    .toEqual([0, 50, 100, 0]);
  expect([50, 45, 40, 80].map(p => scoreAt(p, rule)))
    .toEqual([100, 50, 0, 0]);
  expect(makeRounds('potion-v1:2026-09-15:daily'))
    .toEqual(makeRounds('potion-v1:2026-09-15:daily'));
});

it('accepts STOP once and ignores stale rounds', () => {
  const challenge = { challengeId: 'test', date: '2026-09-15',
    rulesVersion: 'potion-v1' as const,
    rounds: Array.from({ length: 5 }, () => ({ center: 50, halfWidth: 10, periodMs: 4000 })) };
  const initial = createGame('run-a', 'practice', challenge);
  const started = transition(initial, { type: 'START', runId: 'run-a', roundIndex: 0, nowMs: 0 });
  expect(started.activity?.kind).toBe('game_start');
  const stop = { type: 'STOP' as const, runId: 'run-a', roundIndex: 0, nowMs: 1000 };
  const scored = transition(started.state, stop);
  expect(scored.state.scores).toEqual([100]);
  expect(transition(scored.state, stop)).toEqual({ state: scored.state, activity: null });
});
```

- [ ] 실행: `npm test -- app/lib/games/potion-timing/rules.test.ts app/lib/games/potion-timing/session.test.ts`. 미구현 import 실패를 확인한다.
- [ ] 사양 3.1의 positionAt/scoreAt을 구현하고 다음 seed 생성으로 5라운드를 만든다. 입력 규칙은 finite, center±halfWidth가 0–100 안, period>0, 배열 길이5를 검증한다.

```ts
export function makeRounds(seedText: string, slow = false): readonly RoundRule[] {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const centers = [25, 40, 55, 70];
  const widths = [10, 12, 14];
  const periods = [4000, 4800, 5600];
  return Array.from({ length: 5 }, () => ({
    center: centers[next() % centers.length],
    halfWidth: widths[next() % widths.length],
    periodMs: periods[next() % periods.length] * (slow ? 1.8 : 1),
  }));
}
```

- [ ] transition은 먼저 runId/roundIndex/finite nowMs를 확인한다. START는 ready에서만 startedAt 설정, 최초면 hasStarted=true와 시작 알림. STOP은 running·startedAt!=null·nowMs>=startedAt일 때만 아래 방식으로 채점한다. ADVANCE는 round-result에서 index+1과 ready, PAUSE는 running에서 startedAt=null과 paused, RESUME는 paused에서 ready다. 나머지는 원래 state·null 알림으로 반환한다.

```ts
const score = scoreAt(positionAt(command.nowMs - state.startedAtMs,
  state.challenge.rounds[state.roundIndex].periodMs),
  state.challenge.rounds[state.roundIndex]);
const scores = [...state.scores, score];
const finished = scores.length === 5;
return {
  state: { ...state, scores, startedAtMs: null,
    phase: finished ? 'finished' : 'round-result' },
  activity: finished ? { kind: 'game_complete', runId: state.runId,
    mode: state.mode, rulesVersion: state.challenge.rulesVersion } : null,
};
```

- [ ] 각 phase에 PAUSE를 적용한 보존 테스트, 5번 STOP 뒤 점수500 이하·완료1회, 잘못된 시각·배열·새 runId 테스트를 추가한다. 위 명령을 다시 실행해 통과시킨다.
- [ ] 순수 규칙/상태만 diff 검토하고 `feat: add potion timing rules and state machine` 단위로 커밋한다.

## Task 2: 연습 시제품과 입력 검증

**Files:** hook, PotionTimingGame.tsx/CSS, 전용 page, smoke script, package.json.

**Consumes:** T1의 `createGame`, `transition`, `positionAt`, `makeRounds`, `GameActivity`.

**Produces:** `PotionTimingGame(): React.JSX.Element`; `usePotionTimingGame(): { state: GameState | null; dispatch: (type: GameCommand['type'], expected: { runId: string; roundIndex: number }) => void; begin: (mode: GameMode, challenge: Challenge, dailyDeadline?: { expiresAtPerformanceMs: number }) => void; gaugeRef: React.RefObject<HTMLDivElement | null> }`. 공통 알림은 `CustomEvent<GameActivity>`의 detail로 전달한다.

- [ ] `smoke:potion`을 `node scripts/smoke-potion-timing.mjs`로 추가한다. loopback만 허용하는 script에서 5라운드·키보드·중복 입력 검사를 먼저 만들어 미구현 화면 실패를 확인한다.

```js
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3165');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'loopback only');
const browser = await chromium.launch();
const context = await browser.newContext();
await context.route('**/api/analytics/track', route => route.fulfill({ status: 204 }));
await context.route('**/api/analytics/potion/track', route => route.fulfill({ status: 204 }));
const page = await context.newPage();
try {
  await page.goto(new URL('/games/potion-timing', base).href);
  await page.getByRole('button', { name: '일반 연습' }).click();
  for (let round = 0; round < 5; round++) {
    await page.getByRole('button', { name: '가열 시작', exact: true }).click();
    await page.getByRole('button', { name: '불 끄기', exact: true }).click();
    if (round < 4) await page.getByRole('button', { name: '다음 라운드', exact: true }).click();
  }
  await page.getByRole('heading', { name: '이번 포션 결과' }).waitFor();
  assert.equal(await page.getByTestId('round-score').count(), 5);
} finally { await browser.close(); }
```

- [ ] 한 dispatch에서 stateRef의 최신 상태를 동기적으로 전이시킨 뒤 setState한다. reducer 내부나 effect에서 분석/저장 부수효과를 발생시키지 않는다. 다음 형태로 알림을 전달한다.

```ts
if (!stateRef.current) return;
const result = transition(stateRef.current, {
  type, runId: expected.runId,
  roundIndex: expected.roundIndex, nowMs: performance.now(),
});
stateRef.current = result.state;
setState(result.state);
if (result.activity) window.dispatchEvent(
  new CustomEvent<GameActivity>(POTION_ACTIVITY_EVENT, { detail: result.activity }),
);
```

- [ ] native button onClick만 START/STOP에 연결하고 `onKeyDown={event => { if (event.repeat) event.preventDefault(); }}`로 반복 입력을 막는다. 버튼이 렌더된 state의 runId/roundIndex를 expected로 전달해 오래된 핸들러가 새 상태의 식별자를 빌려 쓰지 못하게 한다. 결과와 다음 준비 화면의 버튼은 별도 단계로 렌더한다. RAF는 gaugeRef transform만 갱신하고 unmount/상태 변경 시 취소한다.
- [ ] visibilitychange(hidden)/blur는 PAUSE를 전달한다. paused에는 ‘다시 준비’ 버튼을 표시한다. 시제품은 `makeRounds('potion-v1:prototype', slow)`의 고정 구성으로 일반/느린 연습을 비교하고 진행 중 모드 변경을 막는다. T4의 출시용 연습에서는 seed를 runId로 바꾼다. 불러오지 않은 일일 기능은 이 단계에서 노출하지 않는다.
- [ ] 게임 page는 공통 layout 내부 section을 반환한다. 중복 main을 만들지 않는다. 목표 숫자·구간 테두리·결과 live 영역·44px 버튼·무음·reduced-motion 장식 제거를 구현한다.
- [ ] 키 누름 유지, 빠른 두 번 click, 터치, 숨김/복귀, route 이탈 후 RAF 종료를 script에 추가한다. `npm run smoke:potion`과 typecheck/lint를 통과시킨다.
- [ ] 소수 실제 이용자에게 설명 후 1판 완료/재시도/느린 연습을 관찰한다. 조작 장벽이 반복되면 T3/T4 확대 전 수정 또는 C 대안을 검토한다. 사람 검토 미실시를 자동 테스트로 대체 보고하지 않는다.
- [ ] `feat: add potion timing practice prototype`으로 독립 검토·커밋한다.

## Task 3: 서버 기준 오늘의 도전

**Files:** config/daily/test, daily API/test, hook/UI의 daily 시작 부분.

**Consumes:** `makeRounds(seedText, slow?)`, `Challenge`, `begin(mode, challenge)`.

**Produces:** `DailyChallenge = Challenge & { startsAtMs: number; endsAtMs: number }`, `DailyResponse = { serverNowMs: number; challenge: DailyChallenge }`; `getDailyChallenge(nowMs: number): DailyChallenge`; `parseDailyResponse(value: unknown): DailyResponse | null`; `POTION_GAME_ENABLED: boolean`.

- [ ] 경계 테스트와 API 캐시 헤더 테스트를 먼저 작성한다.

```ts
it('rolls at KST 09:00, not KST midnight', () => {
  const before = getDailyChallenge(Date.parse('2026-09-15T08:59:59.999+09:00'));
  const after = getDailyChallenge(Date.parse('2026-09-15T09:00:00+09:00'));
  expect(before.date).toBe('2026-09-14');
  expect(after.date).toBe('2026-09-15');
  expect(after.startsAtMs).toBe(Date.parse('2026-09-15T00:00:00Z'));
  expect(after.endsAtMs - after.startsAtMs).toBe(86400000);
});
```

- [ ] `npm test -- app/lib/games/potion-timing/daily.test.ts app/api/games/potion-timing/daily/route.test.ts`로 미구현 실패를 확인한다.
- [ ] 순수 함수는 다음 기준으로 challenge를 만들고 응답 parser는 버전·date 형식·challengeId 일치·finite 시각·유효기간24h·5개 라운드·구간 bounds를 검증한다.

```ts
const startsAtMs = Math.floor(nowMs / 86400000) * 86400000;
const date = new Date(startsAtMs).toISOString().slice(0, 10);
const challengeId = `potion-v1:${date}:daily`;
return { challengeId, date, rulesVersion: 'potion-v1', startsAtMs,
  endsAtMs: startsAtMs + 86400000, rounds: makeRounds(challengeId) };
```

- [ ] API는 스위치 false에서404, true에서 아래 응답을 제공한다. config를 route와 홈에서 동일하게 import한다. 단위 테스트는 config mock을 사용한다.

```ts
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!POTION_GAME_ENABLED) return new Response(null, { status: 404 });
  const serverNowMs = Date.now();
  return Response.json({ serverNowMs, challenge: getDailyChallenge(serverNowMs) },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
```

- [ ] daily 버튼은 5초 AbortController timeout과 no-store fetch를 사용한다. timeout은 finally에서 정리한다. 예상 서버 현재 시각은 `serverNowMs + 요청 왕복 경과시간`으로 보수적으로 잡아 이미 만료된 응답은1회 재조회한다. 실패 후 연습 버튼은 활성 상태를 유지한다. 요청 세대 번호를 증가시키고 모드변경/새요청/unmount 때 기존 요청을 abort한다. 응답 적용 직전에 세대와 선택 모드를 다시 검사한다.
- [ ] hook은 서버 응답의 남은 시간을 performance.now 기준 deadline으로 별도 보유한다. hasStarted=false인 첫 START에서 만료를 확인해 새 조회 후 ready로 돌아가며 자동 시작하지 않는다. hasStarted=true이면 해당 판의 snapshot을 유지한다. 재시도 버튼은 새 fetch와 새 runId를 만든다. 08:59조회→09:10첫시작, 진행중09시통과, daily요청→연습시작→늦은응답, 역순응답, 잘못된JSON/timeout을 browser fixture로 테스트한다.
- [ ] 위 테스트와 typecheck를 통과시키고 `feat: add server-dated daily potion challenges`로 검토·커밋한다.

## Task 4: 모드별 개인 기록

**Files:** records.ts/test, UI 결과/기록 영역, hook 완료 처리.

**Consumes:** 완료된 `GameState`, daily는 snapshot의 날짜·버전, 연습은 완료 시의 기기 날짜·버전.

**Produces:** 아래 저장 계약. 브라우저 Storage를 인자로 주입해 node 테스트에서 가짜 저장소를 쓴다.

```ts
export type RunRecord = Readonly<{
  schemaVersion: 1; runId: string; mode: GameMode; rulesVersion: RuleVersion;
  challengeId: string; challengeDate: string; completedAtMs: number;
  scores: readonly number[]; total: number;
}>;
export type RecordStore = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
export function parseRunRecord(value: string): RunRecord | null;
export function readRecords(store: RecordStore, nowMs: number):
  { records: RunRecord[]; storageAvailable: boolean };
export function saveRecord(store: RecordStore, record: RunRecord): boolean;
export function summarizeRecords(records: readonly RunRecord[]):
  Array<{ mode: GameMode; rulesVersion: RuleVersion; challengeId: string;
    first: RunRecord; best: RunRecord }>;
export function clearRecords(store: RecordStore): boolean;
```

- [ ] 저장 실패·동시 탭·모드 격리 테스트를 먼저 작성한다. 고정 UUID로 만든 first/lower/better 결과를 저장하고 best가 낮아지지 않는지 확인한다.

```ts
it('does not crash on blocked storage', () => {
  const blocked = { setItem() { throw new DOMException('blocked', 'SecurityError'); } };
  expect(saveRecord(blocked as RecordStore, {
    schemaVersion: 1, runId: 'd7b360f9-e638-476a-a17e-62ec11a36fb8',
    mode: 'daily', rulesVersion: 'potion-v1', challengeId: 'potion-v1:2026-09-15:daily',
    challengeDate: '2026-09-15', completedAtMs: 1789459200000,
    scores: [100, 80, 60, 40, 20], total: 300,
  })).toBe(false);
});
```

- [ ] `npm test -- app/lib/games/potion-timing/records.test.ts`의 실패를 확인한다. saveRecord는 검증 후 단일 per-run key로 setItem하고 모든 storage 예외를 false로 반환한다.

```ts
export function saveRecord(store: RecordStore, record: RunRecord): boolean {
  try {
    const serialized = JSON.stringify(record);
    if (!parseRunRecord(serialized)) return false;
    store.setItem(`wc:potion:run:v1:${record.runId}`, serialized);
    return true;
  } catch { return false; }
}
```

- [ ] readRecords는 키 목록을 먼저 복사한 뒤 자체 prefix만 파싱/정리한다. 45일 초과 게임 기록만 removeItem하고 최근30일을 표시한다. 차단 시 records=[]와 storageAvailable=false로 반환해 정상 빈목록과 구별한다. window.localStorage 취득 자체도 try/catch로 보호한다. 규칙/모드/challenge별 first/best를 계산한다. practice 저장용 challengeId와 challengeDate는 완료 시 동일한 기기날짜로 확정한다(`potion-v1:<완료날짜>:practice` 또는 `...:slow-practice`). 생성 seed는 runId이며 이 기록 그룹과 별개다. 자정을 넘긴 연습 판도 완료날짜 한 그룹에만 속하는지 테스트한다.
- [ ] 완료 transition 수락 지점에서1회 저장한다. 새로고침·결과 재방문으로 새 완료를 만들지 않는다. 인메모리 결과와 저장 성공 여부를 구분하고 storage 이벤트로 타 탭 기록을 새로 읽는다.
- [ ] 두 탭의 서로 다른 run key, 같은 run 중복 저장, 손상 JSON, total 불일치,45일 pruning, 다른 기능 키 보존, 확인 후 지우기를 검증한다. 테스트 통과 후 `feat: persist local potion game records`로 검토·커밋한다.

## Task 5: 홈·메뉴·공개 경로 통합

**Files:** GameEntryCard.tsx, page.tsx, Header.tsx, game page, config, sitemap/test.

**Consumes:** `POTION_GAME_ENABLED`, 게임 전용 page. **Produces:** 공개 시에만 동일 canonical `/games/potion-timing`으로 연결되는 진입점.

- [ ] sitemap 테스트에 활성화 시 포함·비활성화 시 제외를 추가한다. 홈 브라우저 테스트에 게임 모듈을 내려받지 않는지 검사할 요청 로그를 먼저 추가한다.
- [ ] GameEntryCard는 정적 문구와 Link만 사용한다. 홈의 MerchPromotionCard 다음에 조건부 배치하고 Header의 defaultItems로 데스크톱/모바일을 함께 반영한다.

```tsx
{POTION_GAME_ENABLED && <GameEntryCard />}
// GameEntryCard 안에서 게임 구현/규칙 모듈은 import하지 않는다.
<Link href="/games/potion-timing" prefetch={false}>포션 불조절 해보기</Link>
// Header의 해당 게임 링크에도 prefetch={false}를 적용한다.
```

- [ ] game page는 false에서 notFound(), true에서 metadata title/canonical과 section을 반환한다. sitemap도 같은 스위치로 경로를 추가한다. Footer 변경과 게임 목록 페이지는 추가하지 않는다.
- [ ] 게임 UI를 홈/공통 layout으로 끌어올리지 않았는지 diff와 production 네트워크 로그로 검증한다. 홈 이동·모바일 메뉴닫기·뒤로가기·broadcasts·홍보 배너를 검증한다.
- [ ] `npm test -- app/lib/sitemap.test.ts`, typecheck/lint, smoke를 통과시키고 `feat: add lightweight potion game entry points`로 검토·커밋한다.

## Task 6: 종합 검증·운영 인계

**Files:** smoke script, docs/POTION_TIMING_GAME.md. **Consumes:** T1–T5 공개/비공개 경로, 측정 API가 있으면 별도 요청 차단. **Produces:** 재현 가능한 검증 증적과 릴리스 체크리스트.

- [ ] 모든 browser context에 기존/new 분석 POST를 차단하고 실제 probe가204인지 확인한다. 합성 플레이를 운영 주소로 전송하지 않는다. 게임 기능 테스트에서 DB를 요구하지 않는다.
- [ ] 1440/1024/390/320px, 마우스·터치·Enter/Space, 5라운드, 무입력 계속 대기, 중복 STOP, 느린모드 격리, 숨김/복귀,09시 경계, storage 손상/차단을 자동화한다. 점수 known fixture는 performance clock 기반으로 검증하고 실제 환경에도 동작 smoke를 남긴다.
- [ ] fresh worktree frontend에서 다음을 실행한다. 새 worktree에 기존 `.env*`/`.secrets`를 복사하지 않는다. Next의 설치된 docs와 frontend/AGENTS.md를 구현 전에 읽는다.

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run build
# 별도 터미널에서 실행한다. npm start는 기존 3000 고정 스크립트다.
npx next start -H 127.0.0.1 -p 3165
# 다른 터미널
$env:SMOKE_BASE_URL = 'http://127.0.0.1:3165'
npx playwright install chromium
npm run smoke:potion
```

- [ ] 저장소 루트에서 무키 Docker build를 검증한다. 기존 Dockerfile이 .env*를 제외하므로 별도 API 키 전달을 추가하지 않는다. 폰트 다운로드 등 네트워크 요구와 API 키 요구를 구분한다.

```powershell
docker build --target runner -t wc-potion-smoke:local ./frontend
docker run --rm --name wc-potion-smoke -p 127.0.0.1:3166:3000 wc-potion-smoke:local
```

- [ ] `/api/health`와 게임 동작, `/broadcasts` 무키 저하, `/api/youTubePlayer`의 HTTP200+MISSING_API_KEY를 확인한다. 테스트용 소스 스위치 true build와 false build에서 홈·menu·sitemap·daily route를 각각 검증한다. production 스위치를 테스트 환경으로 오인하지 않게 build 설정을 증적에 남긴다.
- [ ] 현재 CI/CD에는 browser smoke가 없으므로 이 단계는 수동 릴리스 게이트로 명시한다. CI/CD 자동화는 별도 변경이며 수행하지 않은 smoke를 CI가 검증했다고 쓰지 않는다.
- [ ] 문서에 규칙,09시 경계, 로컬30일 표시/45일 정리, 기록 지우기, 접근성 한계, source flag 재빌드 필요, 사용 API/검증 명령/실패 결과를 기록한다. 실제 사용자 검토 결과가 없으면 ‘미실시’로 표시한다.
- [ ] 코드 검토자는 입력 상태/시간/저장·게임 API 계약을 확인한다. 모든 필수 검증 후 `test: verify potion game and document operation`으로 커밋한다. 측정 계획 완료 전에는 재방문 효과 파일럿을 시작하지 않는다.

## 릴리스 시 확인할 사항

구현 후 사용자가 지시한 범위에서만 push/배포한다. 릴리스 기준 SHA, 검증 증적, 실제 스위치 상태, 파일럿 날짜, 운영 담당을 기록한다. 운영 점검은 비파괴 health·공개 경로·인증 경계 확인으로 제한하고 합성 점수를 기록하지 않는다.

중단은 스위치 false 변경 후 재빌드·재배포, 또는 검증된 이전 이미지/커밋으로 복귀한다. 기존 배포는 기본 `docker-compose.server.yml`의13000 포트에서 재기동 교체하며 무중단으로 표현하지 않는다. 게임 중단 시에도 측정 데이터 만료 정리는 계속한다.

## 사양 커버리지

| 사양 | 담당 |
|---|---|
| 점수·5라운드·알림·중복 방지 | T1/T2 |
| 키보드·모바일·느린 연습·무음·중단 | T2/T6 |
| 서버 날짜·결정적 도전·09시·통신 실패 | T3/T6 |
| 첫/최고·모드 격리·로컬 장애·지우기 | T4/T6 |
| 홈 성능·메뉴·스위치·sitemap | T5/T6 |
| 재방문 계측·인증·삭제 운영 | 별도 측정 계획 M1–M4 |
