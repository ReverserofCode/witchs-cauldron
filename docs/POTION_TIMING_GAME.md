# 포션 불조절 — 기능·운영 가이드

기준일: 2026-09-15. 비공식 팬 창작 미니게임이며 모잉의 공식 게임·상품이 아니다.

## 제공 범위

- 경로: `/games/potion-timing`. 홈의 작은 안내 카드와 데스크톱/모바일 메뉴에서 진입한다.
- 5라운드, 라운드별 0–100점, 합계 최대 500점. 움직이는 온도를 목표 중앙에 맞춰 멈추면 높은 점수를 얻는다. 경계와 목표 밖은 0점이다.
- 오늘의 도전: 동일한 서버 기준 날짜에는 같은 5개 규칙을 제공한다. **한국 시각 오전 9시**에 새 도전으로 바뀐다.
- 일반 연습: 실행마다 새 규칙. 느린 연습: 같은 종류의 규칙에서 왕복 주기를 1.8배로 늘린다. 연습에는 날짜 API가 필요하지 않다.
- 로그인, 전역 순위, 확률형 보상, 결제, 사운드, 외부 이미지·영상은 없다. 가마솥은 자체 SVG/CSS다.

## 조작과 중단

버튼 터치/클릭 또는 포커스 후 Enter·Space를 사용한다. 시작, 멈춤, 다음 라운드는 명시적인 입력으로만 진행한다. 키 반복이나 같은 라운드의 중복 명령은 추가 점수를 만들지 않는다.

입력하지 않아도 패배하지 않는다. 화면을 벗어나면 현재 **미채점 라운드만** 멈추고 이전 점수는 유지한다. 돌아와서 다시 준비한 뒤 시작한다. 게임 시작 후 모드 변경으로 진행 중인 기록을 덮어쓰지 않는다. 완료 후 재도전/다른 모드 선택이 가능하다.

점수는 프레임 개수가 아니라 `performance.now()`의 경과 시간으로 계산한다. 프레임이 건너뛰어도 채점 규칙은 바뀌지 않는다. 장식 애니메이션은 `prefers-reduced-motion` 설정에 따라 줄이고, 느린 연습을 별도로 제공한다. 이는 시각 반응 게임이므로 모든 이용자의 접근성을 완전히 해결했다는 의미는 아니다.

## 날짜와 통신

`GET /api/games/potion-timing/daily`는 서버 날짜, 도전, 유효 기간을 제공한다. 응답은 저장 캐시를 사용하지 않는다. 첫 시작 직전 유효 기간이 지났다면 새 날짜를 확인한다. **이미 시작한 게임은 시작 당시 도전을 끝까지 유지**한다.

날짜 요청에는 5초 제한이 있다. 실패 시 오류 안내/재시도 또는 연습을 사용할 수 있다. 늦게 도착한 이전 요청은 새 게임이나 연습을 덮어쓰지 않는다.

## 내 기록

완료한 게임만 이 브라우저의 localStorage에 저장한다. 서버 순위표에는 보내지 않는다.

- 키: `wc:potion:run:v1:<run UUID>` — 한 게임마다 별도 키.
- 일자·모드·규칙 버전별 **첫 완료**와 **최고** 기록을 구분한다.
- 오늘의 도전은 고정된 서버 도전 일자, 연습은 완료 시점의 기기 기준 일자를 쓴다.
- 최근 30일 기록을 표시한다. 45일을 초과한 기록은 다음 읽기 때 정리한다. 미래 시각 기록은 보존하되 표시하지 않는다.
- 시크릿 모드, 저장 공간 부족, 손상된 값, 저장 차단 상황에서도 게임 결과는 확인할 수 있다. 저장하지 못한 사실을 안내한다.
- ‘게임 기록 지우기’는 확인 후 게임 키만 삭제한다. 방송 시청 기록과 다른 설정, 게임 방문 집계 제외 설정은 지우지 않는다.

## 출시와 되돌리기

`frontend/app/lib/games/potion-timing/config.ts`의 `POTION_GAME_ENABLED`가 단일 소스 스위치다. 베타 출시 값은 `true`다. `false`로 변경해 빌드·배포하면 홈/메뉴/사이트맵에서 제거되고 게임 페이지 및 daily API가 404로 닫힌다. 환경 변수로 런타임에 우회하지 않는다.

홈은 기존 ISR 300초를 유지한다. 게임 링크는 `prefetch={false}`로 두며 홈 카드에 게임 훅/엔진을 넣지 않는다. 게임 코드는 게임 경로에 진입할 때 로드한다.

재방문 파일럿은 별도 스위치이며 **이번 출시에서는 비활성**이다. 세부 내용은 [측정 가이드](POTION_RETENTION_MEASUREMENT.md)를 참고한다.

## 검증 명령

`frontend` 디렉터리에서 실행한다.

```powershell
npm ci
npm test -- --maxWorkers=2
npm run typecheck
npm run lint
npm run build
# 운영 standalone 서버를 기동하고 다른 터미널에서 smoke 실행
$env:SMOKE_BASE_URL = 'http://127.0.0.1:3165'
node scripts/start-smoke-server.mjs
# 다른 터미널
npm run smoke:potion
npm run smoke:potion-analytics
npm run smoke:admin
node scripts/smoke-potion-entry.mjs
npm run smoke:promotion
# standalone 서버와 같은 테스트용 Basic Auth 값을 설정한 뒤
node scripts/smoke-potion-endpoints.mjs
```

CI는 `potion_test` 폐기용 PostgreSQL16에서 DB 통합 테스트와 인증된 summary 응답을 검증한다. 별도 Docker 작업은 API 키 없이 이미지를 빌드하여 health, 게임, daily, `/broadcasts` 200 및 `/api/youTubePlayer`의 200/`MISSING_API_KEY` 응답을 확인한다. 운영 DB/인증정보를 이 테스트에 사용하지 않는다.

중단 설정을 검증할 때만 소스 flag를 `false`로 바꿔 다시 빌드하고 loopback standalone 서버에서 `node scripts/smoke-potion-disabled.mjs`를 실행한다. 이 스크립트는 설정을 바꾸지 않으며 페이지/daily 404와 홈/메뉴/사이트맵 제거를 검증한다. 검증 후 의도한 출시 값으로 복구해 **다시 빌드**한다.

게임/분석 smoke는 loopback에서만 실행하며 분석 POST를 가로채 실제 통계를 오염시키지 않는다. 분석 smoke는 실제 provider/client를 사용하는 React fixture이며 Next의 pathname 훅과 파일럿 활성 설정만 테스트용으로 대체한다. 실제 운영 데이터로 플레이 테스트나 삭제 테스트를 하지 않는다.

실제 방문자 대상 사용성 평가와 재방문 효과 검증은 수행하지 않았다. 자동화된 기능 검증 결과와 사람의 사용성 검증을 구분한다. 배포 증거 및 남은 검토 사항은 [릴리스 기록](POTION_RELEASE_2026-09-15.md)에 기록한다.
