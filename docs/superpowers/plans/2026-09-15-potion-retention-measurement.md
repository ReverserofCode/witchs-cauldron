# Potion Retention Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 통계를 훼손하지 않고 포션 게임 첫 이용 브라우저의 당일 재플레이와 7일 재방문을 구별해 관찰한다.

**Architecture:** 같은 PostgreSQL DB에 파일럿 전용 테이블·POST 계약·보호된 집계 경로를 사용한다. 수집/조회/삭제가 다른 DB로 fallback하지 않도록 기존 pg 패키지로 명시적 연결 하나를 사용하는 작은 전용 pool을 만든다. 게임은 작은 도메인 알림만 발행하고 기존 analytics 이벤트·IP/session 연결·집계는 변경하지 않는다.

**Tech Stack:** Next.js Route Handler, TypeScript, 기존 pg/PostgreSQL16, Vitest, Playwright, 기존 GitHub Actions 유지보수 작업.

**Spec:** [개발 사양](../specs/2026-09-15-potion-timing-design.md) 6절. 게임 알림의 타입은 [게임 계획](2026-09-15-potion-timing.md) T1을 따른다.

## Global Constraints

- 규칙 버전은 `potion-v1`이다.
- 신규 런타임 의존성을 추가하지 않는다.
- 홈의 `revalidate = 300`을 유지하고 루트 레이아웃을 동적 렌더링으로 변경하지 않는다.
- 게임 플레이는 분석 DB·YouTube API 키 없이 가능해야 한다.
- 새 식별자를 기존 IP/UA/session/visitor_key와 결합하지 않는다.
- 점수·실제 URL·쿼리·입력 내용은 신규 분석에 전송하지 않는다.
- 운영 주소에 합성 게임 이벤트를 보내지 않는다. DB 검증은 폐기 가능한 로컬 테스트 DB에서만 수행한다.
- 모집28일과 추가 관찰7일을 구별한다. 관측값을 인과 효과나 실제 사람 수로 표현하지 않는다.
- 지금은 계획 작성 단계이며 다음 체크박스는 미실행이다.

## 파일 지도와 병렬 경계

기준 코드: `origin/main@6c01ec057fcd5f93d79c392eca7273396d0ed503`. 게임 구현 worktree에서 최신 기준을 재확인한다.

| 파일 | 작업 / 책임 |
|---|---|
| NEW `frontend/app/lib/analytics/potion-contract.ts`, `.test.ts` | M1: 엄격한 payload/응답 계약 |
| NEW `frontend/app/lib/analytics/potion-config.ts` | M1: 파일럿 기간·허용 origin |
| NEW `frontend/app/lib/analytics/potion-db.ts`, `.test.ts` | M1: 전용 스키마·원자 수집·SQL 통합 테스트 |
| NEW `frontend/app/api/analytics/potion/track/route.ts`, `route.test.ts` | M1: POST body 상한/origin/상태 코드 |
| READ ONLY `frontend/app/api/analytics/db.ts` | 기존 fallback 구조 확인용. 일반 getPool/ensureSchema 변경하지 않음 |
| NEW `frontend/app/lib/analytics/potion-client.ts`, `.test.ts` | M2: ID 수명·제외·재전송·일별 활동 |
| NEW `frontend/app/components/analytics/PotionRetentionProvider.tsx` | M2: 게임 알림/공개 route 활동 소비 |
| MODIFY `frontend/app/layout.tsx` | M2: 기존 provider 옆 작은 observer 추가 |
| MODIFY `frontend/app/components/games/potion-timing/PotionTimingGame.tsx` | M2: 집계 안내/제외 버튼, 게임 로직은 변경하지 않음 |
| NEW `frontend/app/lib/analytics/potion-summary.ts`, `.test.ts` | M3: 기간 검증/성숙 집단/지표 SQL |
| NEW `frontend/app/admin/analytics/potion-summary/route.ts` | M3: 기존 admin 인증 아래 GET |
| NEW `frontend/scripts/smoke-potion-analytics.mjs` | M2/M3: 격리 브라우저/인증 검증 |
| MODIFY `frontend/package.json` | M2: `smoke:potion-analytics` 명령 추가 |
| MODIFY `frontend/scripts/analytics-maintenance.mjs` | M4: potion-profile/retention 모드 |
| MODIFY `.github/workflows/analytics-maintenance.yml` | M4: 게임 모드와 nightly 예약 |
| NEW `frontend/app/lib/analytics/potion-maintenance.test.ts` | M4: 유지보수 경로·격리 DB 검증 |
| NEW `docs/POTION_RETENTION_MEASUREMENT.md` | M3/M4: 지표/데이터 안내/삭제 운영/파일럿 결과 양식 |

M1은 게임 T1의 계약 확정 후 T2/T3와 병렬 진행할 수 있다. M2의 게임 UI 수정은 게임 담당자가 병합하며 동시 편집하지 않는다. M3·M4는 M1 이후 병렬 가능하다. 각 작업은 소유 파일만 변경하고 다른 담당자의 변경을 보존한다.

## Task 1: 독립 수집 계약과 DB

**Consumes:** 기존 pg 패키지, 게임 `GameMode`/`RuleVersion` 타입. 시각은 route에서 주입한다. DB는 `ANALYTICS_DATABASE_URL || DATABASE_URL` 중 첫 설정값 하나만 사용하고 미설정/연결실패는503으로 처리한다.

**Produces:**

```ts
export type PotionPilotEvent = {
  schema_version: 1; visitor_id: string; event_id: string;
} & (
  | { type: 'game_start' | 'game_complete'; run_id: string;
      mode: 'daily' | 'practice' | 'slow-practice'; rule_version: 'potion-v1' }
  | { type: 'site_active' }
);
export type PilotWindow = Readonly<{
  enrollFromMs: number; enrollUntilMs: number; observeUntilMs: number;
}>;
export const POTION_PILOT_WINDOW: PilotWindow | null = null;
export const POTION_ALLOWED_ORIGIN = 'https://moingfans.com';
export type AcceptedEvent = { ok: true; serverNowMs: number;
  expiresAtMs: number; dayKst: string };
export type IngestResult = { status: 200; body: AcceptedEvent } | { status: 204 }
  | { status: 400; body: { error: 'event_conflict' } };
export function validatePotionPayload(input: unknown):
  { ok: true; value: PotionPilotEvent } | { ok: false; error: string };
export function ensurePotionSchema(pool: import('pg').Pool): Promise<void>;
export function getPotionPool(): Promise<import('pg').Pool>;
export function ingestPotionEvent(pool: import('pg').Pool,
  event: PotionPilotEvent, nowMs: number, window: PilotWindow | null): Promise<IngestResult>;
```

- [ ] 알 수 없는 키·식별자·이벤트별 필드 조합을 거부하는 테스트를 먼저 작성한다.

```ts
import { expect, it } from 'vitest';
import { validatePotionPayload } from './potion-contract';
const payload = { schema_version: 1,
  visitor_id: '2197e2ee-e965-471b-bf69-af674815133a',
  event_id: 'c998b107-d983-4422-8015-83ba78b3dc54', type: 'site_active' };
it('accepts only the fields for this event', () => {
  expect(validatePotionPayload(payload).ok).toBe(true);
  expect(validatePotionPayload({ ...payload, score: 500 }).ok).toBe(false);
  expect(validatePotionPayload({ ...payload, run_id: payload.event_id }).ok).toBe(false);
  expect(validatePotionPayload({ ...payload, visitor_id: 'unknown' }).ok).toBe(false);
});
```

- [ ] `npm test -- app/lib/analytics/potion-contract.test.ts app/api/analytics/potion/track/route.test.ts`로 실패를 확인한 뒤 UUID와 event별 정확한 키 집합을 검증한다. object/array/null을 구분하고 schema_version=1을 강제한다.
- [ ] 전용 pool은 연결 대상 하나·최대 연결3개·3초 connect timeout으로 초기화한다. query/connect 오류로 생성 Promise가 거부되면 해당 Promise 캐시를 비워 복구 가능하게 한다. 정상 pool은 hot reload/요청마다 다시 만들지 않는다.

```ts
const connectionString = process.env.ANALYTICS_DATABASE_URL?.trim()
  || process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error('potion_database_not_configured');
const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 3000 });
try {
  const client = await pool.connect();
  client.release();
  return pool;
} catch (error) {
  await pool.end().catch(() => undefined);
  throw error;
}
```

- [ ] body를 스트림으로 읽어 누적 bytes>2048이면 읽기를 취소하고413을 반환한다. Content-Length는 빠른 거부에만 쓰고 부재/거짓 값을 신뢰하지 않는다. JSON 파싱/validation 실패400, production Origin 불일치/부재403, DB 예외503(no-store·민감 정보 없는 error code)를 반환한다. dev/test loopback origin 허용은 NODE_ENV와 실제 요청 origin을 함께 검증한다.
- [ ] 아래 스키마를 IF NOT EXISTS로 생성하고 DB CHECK에도 타입 조합을 강제한다. 새 schema 초기화 실패는 캐시를 비워 다음 요청에서 재시도 가능하게 한다.

```sql
CREATE TABLE IF NOT EXISTS potion_pilot_visitors (
  visitor_id uuid PRIMARY KEY,
  first_started_at timestamptz NOT NULL,
  first_day_kst date NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS potion_visitors_expiry_idx
  ON potion_pilot_visitors(expires_at);
CREATE TABLE IF NOT EXISTS potion_pilot_events (
  event_id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL REFERENCES potion_pilot_visitors ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('game_start','game_complete','site_active')),
  run_id uuid,
  mode text,
  rule_version text,
  occurred_at timestamptz NOT NULL,
  day_kst date NOT NULL,
  CHECK (
    (event_type = 'site_active' AND run_id IS NULL AND mode IS NULL AND rule_version IS NULL)
    OR
    (event_type IN ('game_start','game_complete') AND run_id IS NOT NULL
      AND mode IS NOT NULL AND mode IN ('daily','practice','slow-practice')
      AND rule_version IS NOT NULL AND rule_version = 'potion-v1')
  )
);
CREATE INDEX IF NOT EXISTS potion_events_visitor_day_idx
  ON potion_pilot_events(visitor_id, day_kst);
CREATE UNIQUE INDEX IF NOT EXISTS potion_events_run_type_uq
  ON potion_pilot_events(visitor_id, run_id, event_type) WHERE run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS potion_events_active_day_uq
  ON potion_pilot_events(visitor_id, day_kst) WHERE event_type = 'site_active';
```

- [ ] ingest는 기간 null/관찰 범위 밖이면204, 존재하지 않는 ID는 모집 기간 안의 game_start만 transaction으로 등록한다. 최초값·만료는 ON CONFLICT로 갱신하지 않는다. 같은 timestamp에서 KST 날짜와 expires=timestamp+45일을 만든다. participant row를 잠그고 만료 검사 후 event를 삽입해 동시 완료와 정리를 직렬화한다.
- [ ] complete는 같은 visitor/run의 start가 존재하고 mode/version이 같을 때만 수락한다. eventId 또는 run/type 중복은 기존 행과 payload가 일치할 때만200, 불일치 재사용은400으로 처리한다. eventId 충돌이 새 participant만 남기지 않도록 같은 transaction을 사용한다. 이400은 payload 형식 외 의미 충돌에도 사용한다.
- [ ] 첫 시작·완료 누락·모집 종료 후 신규/기존 ID·45일 경계·동일eventId/동일run 재전송·site_active 하루중복·동시요청·DB복구 테스트를 격리 PostgreSQL에서 실행한다. 일반 분석 테이블은0행 변화여야 한다. 소스 config는 null 상태로 유지한다.
- [ ] API 계약 리뷰 후 `feat: add isolated potion pilot event ingestion`으로 커밋한다.

## Task 2: 식별자와 공개 화면 활동

**Consumes:** 게임의 `POTION_ACTIVITY_EVENT`/`GameActivity`, POST 계약. **Produces:** client adapter와 provider, 개인정보 안내·집계 제외 UI.

```ts
export type PilotIdentity = { visitorId: string; expiresAt: number };
export type PilotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function readPilotIdentity(store: PilotStorage, nowMs: number): PilotIdentity | null;
export function createPilotIdentity(store: PilotStorage, nowMs: number): PilotIdentity | null;
export function excludePilot(store: PilotStorage): boolean;
export function trackPotionEvent(event: PotionPilotEvent): Promise<AcceptedEvent | null>;
export function enqueueGameActivity(detail: unknown): void;
export function PotionRetentionProvider(): null;
```

- [ ] 저장 실패는 identity=null, 기존ID 방문은 expiry 유지, 제외 sentinel은 새ID 생성 금지라는 테스트를 먼저 작성한다.

```ts
it('does not extend an existing identity', () => {
  const values = new Map<string, string>();
  const store = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
  const first = createPilotIdentity(store, 1000);
  expect(first).not.toBeNull();
  expect(createPilotIdentity(store, 5000)).toEqual(first);
  expect(excludePilot(store)).toBe(true);
  expect(createPilotIdentity(store, 6000)).toBeNull();
});
```

- [ ] `npm test -- app/lib/analytics/potion-client.test.ts` 실패 후 try/catch로 저장 실패를 처리한다. ID는 게임 시작에만 생성하며, localStorage에 실제 write/read 성공해야 전송한다. 제외 sentinel `wc_potion_pilot_excluded_v1=1`을 확인한다. 소스 POTION_PILOT_WINDOW=null일 때는 ID 생성/전송을 하지 않는다. 기간의 최종 판정은 서버에 맡기고, 새 임시ID의 시작이204로 거부되면 해당 임시ID를 제거한다. 최초 수락 응답의 server expiry로 로컬 expiry를 정렬하되 이후 응답으로 늘리지 않는다. 측정 거부204는 재시도하지 않는다.
- [ ] 같은 run의 전송 Promise chain으로 start→complete를 순서대로 보낸다. 네트워크/503에 한해5초 timeout, 같은eventId 최대1회 재시도한다. 400/403/413은 재시도하지 않는다. 실패를 throw해 게임 진행을 중단하지 않는다. userId를 console에 기록하거나 오프라인 큐에 저장하지 않는다.
- [ ] provider는 아래처럼 알림을 구독하고 cleanup한다. detail의 런타임 타입도 검증한다. 전송은 이 adapter에서만 하고 기존 AnalyticsProvider는 건드리지 않는다.

```tsx
useEffect(() => {
  const onActivity = (event: Event) => {
    const detail: unknown = (event as CustomEvent).detail;
    // kind/runId/mode/rulesVersion을 검사한 뒤 전송 큐에 넣는다.
    enqueueGameActivity(detail);
  };
  window.addEventListener(POTION_ACTIVITY_EVENT, onActivity);
  return () => window.removeEventListener(POTION_ACTIVITY_EVENT, onActivity);
}, []);
```

`enqueueGameActivity(detail: unknown): void`는 potion-client.ts에서 export하고 provider가 import한다. 시작 알림에서 identity를 만들고 전송 성공 후 반환된 dayKst를 활동일 캐시에 반영한다. 완료 전송은 수락된 시작이 있는 run에만 연결한다. 게임 알림에는 payload 조립에 필요한 필드 외 데이터가 없다.

- [ ] `usePathname` 변경, visible pageshow/visibility 복귀, pointerdown/keydown을 공개경로에서 관찰한다. `/admin` 또는 `/admin/` prefix는 전송 금지다. pathname은 client 판단에만 쓰고 payload에 넣지 않는다. 하루 중복 제거는 성공 응답의 **서버 dayKst**와 DB unique index가 최종 기준이다. 클라이언트 날짜는 요청 절약용이며 서버 응답과 다르면 바로 정렬한다.
- [ ] foreground 자정 경계에서 타이머만으로 전송하지 않는다. 활동 때 서버 dayKst 추정이 새날이면 요청한다. 최초 page 복귀/route 이동은 일별 캐시가 있어도 서버 확인 요청1회를 허용해 틀린 기기시계로 하루 통째 누락하지 않게 한다. 최소60초 간격은 같은 KST날의 site_active 재시도에만 적용하고 새날·복귀 확인1회는 예외로 한다. game_start/complete에는 이 제한을 적용하지 않는다. inflight 중 새날 활동이 있으면 완료 후1회 이어 보내되 타이머가 새 활동을 만들지는 않는다.
- [ ] 안내에 목적/45일 만료/운영DB 정리/누락 한계와 제외 버튼을 추가한다. 제외 성공 시 메모리도 중단하고 다른 탭 storage 이벤트로 반영한다. sentinel 저장 실패 시 ‘현재 탭에서만 제외됨’을 안내한다. 게임 기록 지우기와 구별한다.
- [ ] `smoke:potion-analytics` 명령을 추가한다. browser fixture에서 기존 분석은204로 차단하고 신규 POST는 메모리 수집기로 가로챈다. 미참여/hidden/admin=0건, 시작2회 같은run=1건, 자정 넘은 실제활동=다음날1건, 저장차단=0건, 제외후0건, unmount listener정리를 검증한다. `npm run smoke:potion-analytics` 통과 후 검토·커밋한다.

## Task 3: 보호된 집계와 지표 검증

**Files:** potion-summary.ts/test, admin route, smoke script, 측정 문서.

**Consumes:** M1 스키마, `getKstDateString`/`addDaysToDateString` 기존 날짜 helper. **Produces:**

```ts
export type PotionSummary = {
  generatedAt: string; timezone: 'Asia/Seoul'; identityBasis: 'browser-pilot-id';
  from: string; to: string; observedThrough: string;
  eligible: number; immature: number; siteReturned: number; gameReturned: number;
  siteReturnRate: number | null; gameReturnRate: number | null;
  d0ReplayVisitors: number;
  completion: { eligibleRuns: number; completedWithin24h: number;
    completedLate: number; rate: number | null };
  startsByMode: Record<'daily' | 'practice' | 'slow-practice', number>;
  window: PilotWindow | null;
};
export function validateCohortRange(from: string, to: string):
  { from: string; to: string } | null;
export function getPotionSummary(pool: import('pg').Pool,
  from: string, to: string, nowMs: number): Promise<PotionSummary>;
```

- [ ] 올바른 날짜/윤년/역전/최대45일 범위·분모0 테스트를 작성한다. 기존 날짜 helper가 입력 유효성을 모두 보장한다고 가정하지 말고 YYYY-MM-DD roundtrip 검증을 추가한다.
- [ ] 다음 mature 조건을 사용하는 SQL fixture를 먼저 만든다. first_started는 모집 시작 transaction에 저장한 값이며 조회 기간으로 다시 계산하지 않는다.

```sql
WITH mature AS (
  SELECT * FROM potion_pilot_visitors
  WHERE first_day_kst BETWEEN $1::date AND $2::date
    AND first_day_kst + 7 < $3::date
    AND expires_at > $4::timestamptz
)
SELECT COUNT(*)::int AS eligible,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM potion_pilot_events e WHERE e.visitor_id = mature.visitor_id
      AND e.day_kst BETWEEN mature.first_day_kst + 1 AND mature.first_day_kst + 7
  ))::int AS site_returned,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM potion_pilot_events e WHERE e.visitor_id = mature.visitor_id
      AND e.event_type = 'game_start'
      AND e.day_kst BETWEEN mature.first_day_kst + 1 AND mature.first_day_kst + 7
  ))::int AS game_returned
FROM mature;
```

- [ ] `npm test -- app/lib/analytics/potion-summary.test.ts`를 실행해 실패 후 parameterized SQL을 구현한다. `$3`은 현재 KST날짜와 observeUntil의 KST날짜 중 이른 값으로 두어 관찰 중단 후 성숙하지 않은 집단을 거짓 성숙으로 바꾸지 않는다. `$4`는 실제 서버 now다.
- [ ] 별도 query로 immature(D7미완료), D0 start runId가2개이상인 visitor, mode별starts, start+24h<=관찰cutoff인 run의24h내완료/지연완료를 집계한다. from/to는 모두 참가자의 최초 이용 cohort 범위로 일관되게 적용하고 completion기간/이벤트일 필터로 섞지 않는다. 모든 query에서 expired를 제외한다. 최종 집계는 삭제 전 저장하고 만료 이후 재조회로 과거 수치가 줄어들 수 있음을 명시한다.
- [ ] 같은 fixture에서 D0만=재방문아님, D1/D7=포함, D8=제외, 오늘D7=미성숙, first_start가조회범위밖=제외, 같은날08:59/09:01=당일재플레이, denominator0=null을 검증한다.
- [ ] admin route는 필수 from/to 유효성 실패400, 성공200 no-store, DB실패503으로 반환한다. 기존 `frontend/proxy.ts`의 `/admin/:path*` 인증을 그대로 적용한다. `/api/analytics/potion/stats`라는 보호되지 않은 별도 경로를 만들지 않는다.
- [ ] 실제 production mode 로컬 서버에서 무인증401, 인증 미설정503, 테스트 전용 credential 설정 후200을 smoke로 확인한다. credential은 로그에 출력하지 않는다. Vitest 기본 include는 app/lib/app/api만이므로 admin route 테스트를 그 아래에 잘못 배치하지 말고 summary lib 테스트+browser인증 검증으로 나눈다.
- [ ] 측정 문서에 모든 지표의 분모/성숙조건/시간대/누락/비인과성을 기록한다. 첫주 완료, 중간 재플레이,35일 경과 후 최종집계와 운영시간 양식을 작성한다. `feat: report protected potion retention cohorts`로 검토·커밋한다.

## Task 4: 삭제 운영·회귀 검증·파일럿 준비

**Files:** 기존 maintenance script/workflow, potion-maintenance.test.ts, 측정 문서.

**Consumes:** visitors.expires_at·FK cascade, 운영의 명시적 ANALYTICS_DATABASE_URL 또는 DATABASE_URL. **Produces:** `node scripts/analytics-maintenance.mjs potion-profile`(읽기), `... potion-retention`(게임 만료만 삭제), nightly실행/수동복구 절차.

- [ ] 실패하는 script contract 테스트를 작성한다. potion-retention은 일반 retention/all을 호출하지 않으며 잘못된 명시 DB에 연결 실패하면 다른 후보 DB로 fallback하지 않아야 한다.
- [ ] 삭제 모드 DB 선택은 `ANALYTICS_DATABASE_URL || DATABASE_URL` 중 첫 설정값 하나로 고정하고 없으면 실패한다. URL·credential은 출력하지 않는다. 이 모드만 기존 getCandidates fallback을 우회하며 기존 일반 분석 모드의 동작은 유지한다.
- [ ] transaction에 다음 DELETE와 확인을 추가한다. 만료전 데이터/일반 분석 row는 바뀌지 않아야 한다. 테이블 부재는 profile에서 ‘미설치’로 보고, retention에서는 명시적 실패로 반환해 누락을0건 성공으로 감추지 않는다.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DELETE FROM potion_pilot_visitors WHERE expires_at <= now();
SELECT COUNT(*)::int AS remaining_expired
FROM potion_pilot_visitors WHERE expires_at <= now();
COMMIT;
```

실패는 rollback 후 비정상 종료한다. UUID 대신 삭제건수·remaining_expired·실행시각만 출력한다. potion-profile은 만료건수·가장오래된만료시각·최대expires_at만 읽는다. expiry의 기준 now는 transaction 내 고정이므로 삭제와 잔여 검사 사이 새 경계의 오해를 피한다.

- [ ] 기존 workflow_dispatch 옵션에 두 모드를 추가하고 schedule는 `17 19 * * *`(KST04:17)로 한다. 스케줄 mode는 다음처럼 명시적으로 고정한다.

```yaml
env:
  MODE: ${{ github.event_name == 'schedule' && 'potion-retention' || inputs.mode }}
```

기존 permissions, production environment, 고정 SSH action SHA, fingerprint, main 제한, production-operations 직렬화를 보존한다. 일반 retention/all을 예약하지 않는다. 예약 시작은 게임 테이블이 배포된 후여야 하므로 별도 운영 커밋으로 적용하고 배포 순서를 문서화한다.

- [ ] workflow-guardian 리뷰로 트리거/권한/승인/secret/대상DB를 검증한다. 운영 환경의 수동 승인 필요 여부를 확인하고 우회하지 않는다. 일반 테스트는 SQL mock을 사용하되 DB 삭제 검증은 명시한 폐기 가능한 PostgreSQL에서만 한다.
- [ ] 아래 명령은 **구현·배포 이후** 운영자가 사용할 수동 복구/점검 명령으로 문서화한다. 현재 문서 작성 중에는 실행하지 않는다.

```powershell
gh workflow run "Analytics Maintenance" --ref main -f mode=potion-profile
gh workflow run "Analytics Maintenance" --ref main -f mode=potion-retention
```

- [ ] 담당 운영자가 매일 성공/잔여0을 확인하고 미실행·실패를 같은날 복구하는 책임을 릴리스 체크리스트에 넣는다. 담당 미지정/예약승인 미해결이면 파일럿 모집은 시작하지 않는다. 45일 만료 즉시 수집·조회 제외, 정상운영 시24시간내삭제/운영DB46일목표로 안내한다. 백업·스냅샷은 별도 보관 정책 확인 대상으로 명시한다.
- [ ] 파일럿 종료 때 예약을 바로 끄지 않는다. 마지막 MAX(expires_at) 경과 후 정리·잔여0 증적을 확인할 때까지 유지한다. 조기 전체삭제는 별도 승인 없이 수행하지 않는다.
- [ ] 전체 `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, 게임 smoke·분석 smoke·기존 `smoke:admin`을 실행한다. analytics 일반 contract/stats에 회귀가 없는지 리뷰한다. `feat: maintain potion pilot data retention`으로 커밋한다.

## 격리 검증 환경

운영 자격 증명·데이터를 복사하지 않는다. 테스트 프로그램은 `POTION_TEST_DATABASE_URL`이 있을 때만 DB suite를 실행하고 host가 loopback이며 DB 이름이 `potion_test`인지 검증한다. 아래 값은 폐기 가능한 로컬 테스트 전용이며 운영에는 쓰지 않는다.

```powershell
docker run --rm --name wc-potion-test-db -p 127.0.0.1:5546:5432 -e POSTGRES_DB=potion_test -e POSTGRES_USER=potion_test -e POSTGRES_PASSWORD=local-test-only postgres:16-alpine
# 별도 터미널: frontend 디렉터리
$env:POTION_TEST_DATABASE_URL = 'postgres://potion_test:local-test-only@127.0.0.1:5546/potion_test'
npm test -- app/lib/analytics/potion-db.test.ts app/lib/analytics/potion-summary.test.ts app/lib/analytics/potion-maintenance.test.ts
```

준비 완료는 pg_isready로 확인한다. 테스트는 fixture별 고유 UUID를 사용하고 자신이 만든 fixture만 정리한다. 공유·운영 DB에서 truncate/drop을 실행하지 않는다. DB URL이 없어서 skip된 테스트를 성공 증적으로 세지 않는다. production mode smoke의 ANALYTICS_DATABASE_URL도 이 로컬 DB로 명시하며 외부 fallback이 성공하지 않도록 대상 검사를 먼저 한다.

## 최종 수용 기준

- 게임은 분석 실패·저장 차단과 무관하게 완료할 수 있다.
- 일반 analytics의 계약·인증·집계가 유지된다.
- 중복·성숙도·KST경계 SQL fixture와 실제 인증 경계가 검증된다.
- 첫 이용/완주/재시도/재방문의 의미가 결과 JSON과 문서에서 일치한다.
- 집계 안내·제외 동작·만료 삭제와 운영 책임이 준비된다.
- 파일럿 날짜를 실제로 정하기 전 config는 null이며 수집하지 않는다.
- 후속 릴리스에서 T0를 정하면28일모집·35일경과최종집계 시각을 함께 기록한다. 모집28일 시점은 중간보고이지 전참가자의 최종7일 결과가 아니다.
