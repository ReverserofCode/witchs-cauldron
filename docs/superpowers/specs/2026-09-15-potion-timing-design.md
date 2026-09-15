# 재방문 콘텐츠 재검토 — 포션 불조절 개발 사양

- 작성일: 2026-09-15, Asia/Seoul
- 상태: **권장 개발안**. 사용자가 특정 게임의 구현을 확정한 것으로 간주하지 않는다. 이번 작업은 재검토와 개발 계획 작성이며 구현·커밋·배포는 수행하지 않는다.
- 기존 기획: [재방문 콘텐츠 제안](../../CONTENT_RETENTION_PROPOSAL_2026-09-15.md)
- 개발 기준: 확인한 `origin/main`의 `6c01ec057fcd5f93d79c392eca7273396d0ed503`. 실행 시 최신 main을 다시 확인한다. 현재 루트 작업 브랜치의 이전 코드에 직접 덧붙이지 않는다.

## 1. 후보별 결론

| 후보 | 재검토 결과 | 이번 개발 범위 |
|---|---|---|
| 입문 영상 선별 가이드 | 사용자가 폐기. 일관된 선정 기준을 확보하기 어려움 | 제외, 재제안하지 않음 |
| A. 공방 실험실: 주 3회 논리 퍼즐 | 혼자 즐길 수 있으나 4주 12문제의 제작·정답·복수 해석 검수가 계속 필요 | 보류 |
| B. 포션 불조절 | 짧은 조작, 공방 테마, 반복 원고 제작 불필요. 반응 조작의 접근성과 재미는 미검증 | **첫 개발 대상으로 권장** |
| C. 포션 짝맞추기 | 시간제한 없이 참여 가능. 카드 구별·키보드 접근성 검증은 여전히 필요 | B 시제품에서 조작 장벽이 크면 대안으로 검토. 동시 개발하지 않음 |
| D. 재료 받기 | 지속 조작, 터치 가림, 충돌 판정 등 검증 범위가 큼 | 후순위 |
| 주간 팬 선택/투표 | 참여 규모와 문항 편집·중복 참여 관리 필요 | 보류 |
| 지난 방문 이후 새소식 | 유용하지만 방송 모아보기의 새 방송 필터와 일부 중복 | 별도 편의 기능 후보, 게임 파일럿과 동시 출시하지 않음 |

추천 근거는 테마 적합성과 반복 편집 부담이다. 실제 이용자 수·재방문율·재미를 확인한 결과가 아니다. 날짜별 배치 변경이 재방문 이유가 되는지 검증한다. 굿즈 홍보와 방송 모아보기는 기존 기능으로 유지하며 이번 계획에서 재설계하지 않는다.

## 2. 첫 출시 범위

- `/games/potion-timing`에서 게임 1개만 제공한다. 홈에는 경량 진입 카드, 공통 메뉴에는 링크를 둔다.
- 버튼으로 움직이는 온도 표시를 멈춘다. 5라운드, 라운드당 0–100점, 한 판 최대 500점이다.
- 모드는 `daily`, `practice`, `slow-practice`다. daily는 기본 속도만 사용하며 모드 변경은 새 판 시작 전에만 가능하다.
- 약 30–60초는 예상 이용 시간이다. 무입력으로 강제 실패시키거나 자동으로 다음 라운드를 시작하지 않는다.
- 오늘의 도전은 KST 09:00에 바뀐다. 재시도를 허용하고 같은 도전의 첫 **완료** 점수와 최고 점수를 구분한다.
- 점수·기록은 브라우저에 저장한다. 로그인·클라우드 동기화·공식 순위·부정행위 방지 시스템은 만들지 않는다.
- 최초 버전은 무음이다. 기존 제안의 소리 켜기 옵션은 제외한다. 직접 만든 도형과 텍스트만 사용하고 허가 없는 상품 이미지·방송 음성은 추가하지 않는다.
- 스킨, 보상, 출석 연속 보너스, 상점, 공유 이미지 생성, 복수 게임, 별도 게임 엔진은 제외한다.

### 공통 제약

- 규칙 버전은 `potion-v1`이다.
- 신규 런타임 의존성을 추가하지 않는다.
- 홈의 `revalidate = 300`을 유지하고 루트 레이아웃을 동적 렌더링으로 변경하지 않는다.
- 모든 게임 진입 링크에 `prefetch={false}`를 적용한다.
- 팬 창작 미니게임이며 모잉의 공식 설정·발언·공식 게임으로 표현하지 않는다.
- 실제 상품 이미지·방송 장면·음성의 신규 수집은 범위에서 제외한다.
- 게임 플레이는 분석 DB·YouTube API 키 없이 가능해야 한다.

## 3. 게임 규칙과 상태

### 3.1 규칙

라운드는 `{ center, halfWidth, periodMs }`로 표현한다. 눈금은 0–100이다. 온도 표시는 0에서 출발해 한 주기 동안 0→100→0으로 움직인다.

```ts
export type GameMode = 'daily' | 'practice' | 'slow-practice';
export type RuleVersion = 'potion-v1';
export type RoundRule = Readonly<{
  center: number;
  halfWidth: number;
  periodMs: number;
}>;

export function positionAt(elapsedMs: number, periodMs: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(periodMs) || periodMs <= 0) {
    throw new RangeError('invalid_clock');
  }
  const phase = (Math.max(0, elapsedMs) % periodMs) / periodMs;
  return 100 * (1 - Math.abs(2 * phase - 1));
}

export function scoreAt(position: number, rule: RoundRule): number {
  if (!Number.isFinite(position) || position < 0 || position > 100 ||
      !Number.isFinite(rule.center) || !Number.isFinite(rule.halfWidth) ||
      rule.halfWidth <= 0) throw new RangeError('invalid_rule');
  const distance = Math.abs(position - rule.center);
  return distance >= rule.halfWidth ? 0 :
    Math.round(100 * (1 - distance / rule.halfWidth));
}
```

화면에는 ‘중앙 100점 · 경계 및 구간 밖 0점’으로 안내한다. 예: center=50, halfWidth=10일 때 위치 50→100점, 45→50점, 40→0점이다.

공개 설정 후보는 center `[25, 40, 55, 70]`, halfWidth `[10, 12, 14]`, periodMs `[4000, 4800, 5600]`이다. 시제품에서 조정할 수 있지만 공개된 `potion-v1`의 생성 알고리즘·상수·점수식을 변경하면 새 버전을 사용한다. 느린 연습은 같은 설정에서 periodMs를 1.8배로 한다.

### 3.2 상태와 입력

`ready → running → round-result → ready`를 반복하고 다섯 번째 채점에서 `finished`로 이동한다. `running`에서만 STOP을 수락한다. 각 명령에 `runId`와 `roundIndex`를 넣어 이전 라운드의 지연 입력을 무시한다.

- 버튼의 native `onClick`을 하나의 활성화 경로로 사용한다. pointerdown과 click을 함께 채점에 연결하지 않는다.
- 키보드는 포커스한 버튼의 Enter/Space를 사용한다. 반복 keydown은 차단하고 전역 Space 핸들러는 만들지 않는다.
- 같은 UI 버튼을 연속 재사용해 STOP의 잔여 입력이 다음 START가 되지 않도록, 라운드 결과와 ‘다음 라운드’ 단계를 분리한다.
- `performance.now()`의 경과 시간으로 채점한다. RAF는 화면 표시만 담당한다. 프레임 수로 점수를 계산하지 않는다.
- `visibilitychange`의 hidden 또는 window blur가 running 중 발생하면 `paused`로 전환하고 미채점 라운드의 시작 시각만 비운다. 이미 확정한 점수는 보존한다. 복귀 후 ‘다시 준비’로 ready에 돌아간다.
- ready/round-result/finished에서 숨김이 발생하면 기존 상태를 보존한다. 화면 이탈로 한 판 전체 기록을 지우지 않는다.
- 새 판마다 UUID runId를 생성한다. 첫 라운드 START 수락 시 game_start 1회, 마지막 STOP 수락 시 game_complete 1회라는 도메인 알림을 발생시킨다. React effect 재실행이 중복 알림을 만들지 않게 한다.

단조 시각을 사용하는 근거는 [MDN Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now), 숨김 감지는 [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)를 참고한다. 이 방식이 입력 장치의 지연 차이까지 없애지는 않는다.

### 3.3 접근성

320px에서도 가로 넘침 없이 조작할 수 있어야 한다. 버튼은 최소 44×44px, 명확한 포커스 표시와 설명을 제공한다. 색상 외에 테두리·눈금·목표 숫자로 구간을 구별한다. `aria-live`는 라운드 결과에만 사용하고 매 프레임 읽지 않는다. reduced-motion에서는 장식 효과를 제거하고 느린 연습을 안내한다. 핵심 움직임·반응 조작의 한계는 남으므로 접근성이 완전히 해결됐다고 주장하지 않는다.

## 4. 날짜와 오늘의 도전

GET `/api/games/potion-timing/daily`를 게임 전용 서버 계약으로 사용한다. 기존 health를 변경하지 않는다.

```ts
export type DailyChallenge = Readonly<{
  challengeId: string; // potion-v1:YYYY-MM-DD:daily
  date: string;        // 해당 도전이 KST 09:00에 시작한 날짜
  rulesVersion: 'potion-v1';
  startsAtMs: number;
  endsAtMs: number;
  rounds: readonly RoundRule[]; // 반드시 5개
}>;
export type DailyResponse = Readonly<{
  serverNowMs: number;
  challenge: DailyChallenge;
}>;
```

- UTC 자정이 KST 09:00이므로 `floor(nowMs / 86400000) * 86400000`이 시작 시각이다. 만료 시각은 24시간 뒤다.
- 날짜와 버전 문자열의 FNV-1a 32비트 seed, 명시적 unsigned LCG로 검증된 설정 배열에서 5개를 선택한다. Math.random을 일일 도전에 사용하지 않는다.
- route는 `force-dynamic`, `Cache-Control: no-store, max-age=0`. 정상 200, 소스 스위치 비활성 404. 외부 API·DB 호출은 없다.
- 클라이언트는 daily 새 판을 만들 때마다 no-store로 조회한다. 5초 timeout과 엄격한 응답 검증을 적용한다. 첫 START 전 만료되면 다시 조회하고 사용자가 다시 시작하도록 한다. 첫 START를 수락한 뒤부터 전체 challenge를 고정하며, 완료 전 09:00을 지나도 원래 challengeId에 저장한다.
- 모드 변경·새 요청·페이지 이탈은 이전 요청을 취소한다. 요청 세대 번호를 검사해 늦은 daily 응답이 이미 시작한 연습이나 더 최근 요청을 덮어쓰지 못하게 한다.
- 조회 지연 동안 도전이 만료된 응답은 다시 조회하며 자동 재조회는 1회로 제한한다. 서버 시각과 요청 경과 시간으로 보수적으로 남은 시간을 계산한다. 잘못된 기기 날짜를 도전 선택에 사용하지 않는다.
- 조회 실패·응답 형식 오류 때 daily 시작을 막고 ‘오늘의 도전을 확인하지 못했어요. 연습은 이용할 수 있어요’를 표시한다. 클라이언트 날짜로 일일 도전을 조용히 대체하지 않는다.
- 연습은 crypto seed와 runId로 로컬에서 생성한다. 네트워크가 없어도 이미 로드된 게임에서 연습 가능하다. PWA·완전 오프라인 페이지 설치는 범위 밖이다.
- 서버 테스트의 시각은 함수 인자로 주입한다. 공개 API에 날짜 override 파라미터를 만들지 않는다.

## 5. 로컬 기록

- 완료 판별 키 `wc:potion:run:v1:<runId>`에 완료 결과를 한 번 저장한다. 키가 분리되어 두 탭의 서로 다른 판이 같은 aggregate를 덮어쓰지 않는다.
- 레코드는 schemaVersion=1, runId, mode, rulesVersion, challengeId, challengeDate, completedAtMs, scores(정수 5개), total을 갖는다. daily는 시작 snapshot의 challengeId/date를 사용한다. 연습은 완료 시 로컬 날짜로 challengeDate와 저장용 challengeId를 함께 확정하고 ‘기기 기준’으로 표시한다. 연습 생성 seed는 runId이며 저장용 날짜 그룹과 별개다.
- 합계는 scores로 재계산해 검증한다. 저장 문자열/형식/버전/숫자가 잘못되면 해당 레코드를 무시한다. 기존 다른 기능의 localStorage 키를 삭제하지 않는다.
- 최근 30일 기록을 보여 주며 45일보다 오래된 해당 게임 레코드만 정리한다. 같은 그룹 `(mode, rulesVersion, challengeId)`의 가장 이른 완료와 최고 점수를 계산한다. 동률은 완료 시각, runId 순으로 정한다.
- storage 이벤트로 다른 탭의 새 완료를 반영한다. 개별 저장 키 덕분에 동시 쓰기를 허용하되 동시 삭제/저장까지 강한 트랜잭션을 보장하지 않는다.
- 저장 거부·용량 초과 때 인메모리 결과는 유지하고 ‘이 브라우저에 기록을 저장하지 못했어요’를 표시한다. 저장 안 된 결과를 영구 최고 기록처럼 표현하지 않는다.
- ‘게임 기록 지우기’는 확인 후 게임 키만 지운다. 이후 최초 기록은 초기화된다. 분석 식별자 삭제/집계 제외 설정과는 구분한다.

## 6. 독립적인 파일럿 측정 사양

기존 wc_session은 최초 발급 시부터 30일이고 경로별 pageview 중복 제거도 있다. 기존 `returningVisitorRate`는 이번 게임 첫 이용 집단의 7일 재방문율이 아니다. 기존 통계 계약을 바꾸지 않고, 같은 PostgreSQL DB에 별도 파일럿 테이블·경로를 추가한다. 파일럿 수집·조회·정리는 명시적으로 설정한 동일한 DB 하나만 사용한다. 기존 연결의 다른 DB fallback을 상속하지 않는 작은 전용 pool을 사용해 대상 불일치를 막는다.

### 6.1 수집 범위

- 첫 명시적 game_start에서 파일럿 전용 브라우저 UUID를 만든다. localStorage 저장 실패 시 측정을 하지 않으며 게임은 계속한다.
- `wc_potion_pilot_v1 = { visitorId, expiresAt }`, 고정 45일. 방문으로 수명을 연장하지 않는다. 서버의 최초 수락 시각·만료가 최종 기준이다.
- 점수는 전송하지 않는다. IP·UA·기존 session·referrer와 연결하지 않는다. 기존 일반 사이트 분석은 기존대로이며 이 설명은 신규 파일럿 수집 범위만 뜻한다.
- game_start/game_complete에는 eventId, runId, mode, rulesVersion만 전송한다. site_active에는 식별자와 eventId만 포함한다. URL·쿼리·키 입력 내용은 보내지 않는다.
- 전역의 작은 provider는 이미 참여한 브라우저에만 동작한다. 공개 화면의 보이는 상태로 진입/복귀/경로 이동/포인터·키보드 활동 시 하루 1회 site_active를 수집한다. `/admin`과 하위 경로는 제외한다. 자정이 지났다는 타이머만으로 활동을 만들지 않는다.
- ‘방문 집계 안내’에 목적, 보관, 한계, ‘이 브라우저의 게임 집계 제외’ 버튼을 제공한다. 제외 플래그를 저장하고 ID를 지우면 이후 신규 파일럿 전송을 멈춘다. 과거 서버 데이터의 즉시 삭제를 약속하지 않으며 만료 정리 정책을 명시한다.
- 새로운 지속적 가명 식별자라는 점을 문서화한다. ‘개인정보를 전혀 추가하지 않는다’고 표현하지 않는다. 법적 준수 여부를 이 계획만으로 판정하지 않는다.

### 6.2 API·운영

POST `/api/analytics/potion/track`: event별 키 allowlist, UUID, 2KiB body 상한, first-party Origin 검사, 서버 타임스탬프를 사용한다. 재시도는 같은 eventId로 최대 1회, 오프라인 큐는 만들지 않는다. 한 run의 start→complete 전송은 직렬화한다.

`200 {ok:true, serverNowMs, expiresAtMs, dayKst}`는 수락 또는 멱등 중복, 204는 측정 제외/기간 외, 400/413은 잘못된 입력, 403은 origin 거부, 503은 DB 실패다. 완료만으로 참여자를 생성하지 않으며 수락된 start 없는 complete는 204 처리한다. 분석 실패는 플레이를 막지 않는다.

소스 설정 `POTION_PILOT_WINDOW: { enrollFromMs, enrollUntilMs, observeUntilMs } | null`의 초기값은 null이다. 파일럿 시작 날짜를 실제로 정한 릴리스에서만 채운다. 모집 `[T0, T0+28일)`, 관찰 `[T0, T0+35일)`이며 모두 KST 자정 기준이다. 모집 종료 후 기존 ID의 재이용은 관찰 종료까지 받되 새 ID는 등록하지 않는다. 35일이 **경과한** KST 자정 이후 최종 집계한다.

GET `/admin/analytics/potion-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`를 기존 `/admin/:path*` 인증 아래 둔다. 집계 전용 JSON으로 시작하고 기존 대시보드는 개편하지 않는다. 운영에서 미인증 401, 인증 설정이 없으면 기존 정책대로 503이며 어떤 경우에도 집계 JSON이 공개되지 않아야 한다.

만료 참가자는 조회·수집에서 제외한다. 일 1회 정리로 정상 운영 시 만료 후24시간 안에 삭제해 운영 DB 보관을46일 이내로 관리한다. 운영 실패 시 정리 지연 가능성을 숨기지 않는다. 백업·스냅샷 보관은 이 운영 DB 논리 삭제와 별도로 확인한다. 정리 담당·실행 방법·증적·종료 후 최종 정리는 측정 계획에 포함한다.

### 6.3 정확히 볼 지표

| 지표 | 정의/한계 |
|---|---|
| 첫 이용 브라우저 | 파일럿 최초 game_start가 수락된 UUID 수. 완료 여부와 무관 |
| 7일 사이트 재방문 | D0 첫 이용 후 KST 달력 D1~D7에 site_active 또는 게임 이벤트가 관측된 UUID / D7이 완전히 지난 UUID |
| 7일 게임 재이용 | 같은 분모에서 D1~D7에 game_start가 관측된 UUID |
| 당일 재플레이 | D0에 서로 다른 runId의 game_start가 2개 이상인 UUID |
| 관측 완료율 | 시작 후 24시간 관찰이 끝난 run 중 complete가 있는 비율. 지연 완료는 별도 수치. 미완료를 확정 이탈이라고 부르지 않음 |
| 모드 분포 | daily/practice/slow-practice의 수락된 시작 수. 기기 정보는 새로 수집하지 않음 |
| 운영 부담 | 주간 검토·문의·편집 시간, 오류 개선 개발 시간은 별도 |

분모 0은 `rate: null`이다. 미성숙 집단 수, 모집/관찰 기간, 기준 시각, Asia/Seoul, 브라우저 식별자 기준, 저장 차단·삭제·다중 기기·실패 전송에 따른 누락을 함께 표시한다. 홈페이지 노출 대비 시작률, 첫 라운드 이탈률, 기기별 전환율은 이 최소 수집만으로 산출하지 않는다. 이전 제안의 해당 측정은 이번 MVP에서 제외하고 시제품 관찰로 대신한다.

09시 도전 갱신과 자정 재방문 날짜를 혼동하지 않는다. 같은 날 08:59→09:01의 두 도전은 재플레이이지 다른 날짜 재방문이 아니다. 관찰 연구이므로 재방문 증가를 게임의 인과 효과로 단정하지 않는다. 안 A의 20% 기준은 안 B에 가져오지 않는다.

## 7. 통합·공개·중단 정책

- 게임 소스는 전용 route에서 로드한다. 홈 진입 카드는 게임 rules/UI를 import하지 않는다.
- 소스 상수 `POTION_GAME_ENABLED` 하나로 페이지·진입 카드·메뉴·sitemap·daily API를 함께 제어한다. 초기 개발에서는 false를 기본으로 두고 로컬 테스트 fixture에서 true를 사용하거나 작업 브랜치에서만 켠다.
- 이 스위치는 **재빌드·재배포**가 필요하다. 즉시 원격 중단이나 이미 열린 탭 강제 중단을 보장하지 않는다. 런타임 환경 변수 체계·compose·CD 환경 전파 변경은 이번 MVP에서 제외한다.
- 홈 ISR, 방송 모아보기, 홍보 기간 노출, 기존 분석 인증을 회귀 검증한다.
- 기존 `frontend/deploy.sh`는 기본적으로 `docker-compose.server.yml`, 운영 로컬 포트 13000을 사용한다. 코드상 컨테이너 재기동 교체 방식이며 무중단이라고 설명하지 않는다.
- 이번 계획 수립은 배포 승인으로 해석하지 않는다. 후속 구현·릴리스 작업에서 검증 증적과 사용자가 지시한 배포 범위를 확인한다.

## 8. 개발 순서와 판단 게이트

1. **핵심 시제품**: 고정 5라운드, 점수·입력·느린 연습·일시정지. 설명만으로 완료 가능한지 소수 실제 이용자에게 확인한다. 모집·검토 시간이 필요하면 자동 테스트 통과와 사용자 검증을 구분해 보고한다.
2. **오늘의 도전/기록**: 서버 일자·결정적 규칙·저장 장애·모드 격리 구현. 시제품 조작 장벽이 해결되지 않으면 여기로 확대하지 않고 B 수정 또는 C 전환을 검토한다.
3. **통합/측정**: 홈·메뉴 통합과 별도 분석 계약 구현을 병렬 진행한다. 개인정보 안내·집계·정리 운영을 준비한다.
4. **검증/공개 준비**: 브라우저/무키 빌드/분석 DB 격리 테스트·코드 리뷰·롤백 절차를 통과한다. 두 계획이 완료돼야 재방문 파일럿을 시작한다.
5. **28일 모집+7일 추가 관찰**: 첫 주 조작·완료, 중간 재플레이, 종료 후 성숙 집단 재방문과 운영 부담을 검토한다. 자료가 적으면 ‘판단 자료 부족’으로 분류한다.

개발 공수의 초안은 게임 5–8 인일, 측정·운영 검증 3–5 인일이다. 실제 이용자 검토 대기, 코드 기준 변화, 운영 일정, 배포 승인은 별도이며 확정 견적이 아니다. 4주 모집 기간을 개발 공수와 합쳐 며칠 내 효과를 검증할 수 있다고 약속하지 않는다.

## 9. 실행 문서

- [게임 구현 계획](../plans/2026-09-15-potion-timing.md)
- [재방문 측정 구현 계획](../plans/2026-09-15-potion-retention-measurement.md)

본 사양을 현재 권장안의 기준으로 삼는다. 기존 제안과 다른 부분은 소리 기능 제외, 최소 계측 범위 축소, 비활성화의 재배포 필요성, 추가 7일 관찰 명시다.
