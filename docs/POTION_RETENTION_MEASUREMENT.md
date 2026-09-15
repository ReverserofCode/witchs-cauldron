# 포션 미니게임 재방문 측정 운영

## 이번 출시 상태

`POTION_PILOT_WINDOW = null`이다. 게임은 이용할 수 있지만 파일럿 식별자 생성/전송/신규 수집을 시작하지 않는다. 활성 시작일이나 운영 담당자를 임의로 지정하지 않았다. 기존 사이트 Analytics는 이 실험과 별도로 유지된다.

활성화 전에는 사람 대상 사용성 확인, 집계 담당자 지정, 개인정보 안내 확인, 명시적 DB 설정, 삭제 스케줄/승인 준비를 완료한다. 구현되어 있다는 이유만으로 실험이 시작된 것으로 보지 않는다.

## 측정 단위와 수집

분석 단위는 사람이나 로그인 계정이 아니라 **브라우저에 보관한 임의 파일럿 UUID**다. 첫 게임 시작 때만 생성하며 저장 성공을 확인한 후 전송한다. 일반 방문만으로는 참여시키지 않는다. 브라우저 변경·저장 차단·초기화·전송 실패는 누락 또는 중복 참여를 만들 수 있다.

게임 전용 endpoint는 `POST /api/analytics/potion/track`이며 고정된 schema v1만 받는다.

| 이벤트 | 의미 | 추가 필드 |
|---|---|---|
| `game_start` | run의 첫 라운드가 실제 시작됨 | run UUID, 모드, 규칙 버전 |
| `game_complete` | 해당 run 5라운드 완료 | 동일 run/모드/규칙 버전 |
| `site_active` | 참여 브라우저가 공개 화면에서 실제 활동 | 없음 |

공통 필드는 schema version, visitor UUID, event UUID다. 점수, IP, User-Agent, 닉네임, 페이지 URL은 게임 집계 payload/테이블에 저장하지 않는다. 웹 서버·프록시 접근 로그는 별도의 운영 정책 대상이다.

화면이 숨겨져 있거나 관리자 경로라면 전송하지 않는다. 페이지 진입/복귀와 pointer/keyboard 활동만 관찰하며 타이머만으로 재방문을 만들지 않는다. 게임은 집계 성공 여부와 무관하게 진행된다.

서버 시각과 KST 활동일을 기준으로 집계하며 이벤트 ID는 재시도 동안 유지한다. 네트워크/503에만 5초 제한 및 최대 1회 재시도, 204/400/403/413에는 재시도하지 않는다. 오프라인 큐는 만들지 않는다. 완료는 수락된 시작 뒤에만 전송하고 서버도 시작과 run/모드/버전 일치를 검증한다.

## 지표 정의

관리자용 JSON: `/admin/analytics/potion-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`. 기존 production Basic Auth 보호 경로를 사용하며 식별자 목록을 반환하지 않는다. 날짜 범위는 첫 참여 코호트 기준, 양 끝 포함 최대 45일이다.

- `eligible`: D0 다음 D1–D7을 모두 관찰할 수 있는 성숙 참여자 수. 미성숙 참여자는 `immature`로 분리한다.
- `siteReturned`: 성숙 참여자 중 D1–D7에 어떤 게임 집계 활동이라도 있는 브라우저.
- `gameReturned`: 성숙 참여자 중 D1–D7에 새 `game_start`가 있는 브라우저.
- `siteReturnRate`, `gameReturnRate`: 해당 수 / eligible × 100. 분모 0은 **null**이다.
- `d0ReplayVisitors`: 최초 참여일에 서로 다른 run을 2개 이상 시작한 브라우저. 재방문과 구분한다.
- `completion.eligibleRuns`: 시작 후 24시간을 관찰할 수 있는 run.
- `completedWithin24h`: 시작 후 24시간 이내 완료. `completedLate`는 그 이후 완료를 따로 보고하며 성공률에 섞지 않는다.
- `startsByMode`: daily/practice/slow-practice 시작 건수. 난이도가 다르므로 점수 비교 지표로 쓰지 않는다.

파일럿 설정은 모집 28일과 관찰 35일 경과 종료를 함께 기록한다. 모집 종료는 최종 보고가 아니다. 최종 집계는 관찰 종료 시점까지 고정하고, 식별자 만료 전에 비식별 합계 보고를 남긴다. 실험 대조군이 없으므로 단순 변화만으로 게임이 재방문을 **유발했다**고 단정하지 않는다.

## 보관·제외

식별자와 서버 참가자는 최초 수락 후 45일에 만료되며 방문으로 연장되지 않는다. 만료된 참가자는 수집과 집계에서 즉시 제외한다. 제외 버튼은 이 브라우저의 이후 전송을 중단하고 로컬 식별자를 지운다. 기존 서버 자료의 즉시 삭제를 뜻하지는 않는다. sentinel 저장 실패 시 현재 탭에서만 제외됨을 안내한다.

운영 DB의 만료 참가자를 지우면 FK cascade로 그 참가자의 게임 이벤트만 삭제된다. 정상적인 일일 정리 실행 시 만료 후 24시간 안에 삭제하는 **운영 DB 46일 이내 목표**다. 백업·스냅샷의 보관/복구 정책은 별도 확인해야 한다.

## DB와 정리 명령

게임 DB 연결과 게임 정리 명령은 `ANALYTICS_DATABASE_URL`, 없으면 `DATABASE_URL`의 **명시적 단일 대상**만 선택한다. 접속 실패 시 다른 기본 DB로 재시도하지 않는다. 게임 전용 pool 최대 연결 수는 3이다. 일반 Analytics의 연결 동작은 이번 변경에서 바꾸지 않는다.

```powershell
# main 배포 후 운영자가 필요할 때 실행하는 수동 워크플로우
gh workflow run "Analytics Maintenance" --ref main -f mode=potion-profile
gh workflow run "Analytics Maintenance" --ref main -f mode=potion-retention
```

`potion-profile`은 만료 건수/최초 만료/최대 만료만 조회하며 테이블 미설치를 구별한다. `potion-retention`은 트랜잭션 안에서 만료 참가자만 삭제하고 잔여 만료 건수를 검사한다. 테이블 미설치나 연결/삭제 실패는 비정상 종료한다. URL·암호·UUID를 출력하지 않는다. 기존 `retention`/`all`과 연결하지 않는다.

## 파일럿 활성화 체크리스트

- [ ] 운영자와 시작 시각 T0, 모집 종료, 관찰 종료를 함께 확정한다.
- [ ] 초기 사용성 평가와 안내·제외 동작을 확인한다.
- [ ] 운영 DB의 명시적 연결 대상과 게임 스키마 설치를 확인한다.
- [ ] 기존 production environment/SSH fingerprint/권한/main 제한을 보존한다.
- [ ] 별도 운영 커밋에서 KST 04:17 매일 `potion-retention`만 예약한다. GitHub cron UTC 표현은 `17 19 * * *`이다. 현재 예약은 추가하지 않았다.
- [ ] 매일 성공 및 `remaining_expired=0`을 확인하고 미실행·실패를 같은 날 복구할 담당자를 지정한다. 필요한 환경 승인을 우회하지 않는다.
- [ ] 준비가 끝난 뒤에만 null 설정을 실제 파일럿 창으로 바꿔 배포한다.
- [ ] 마지막 `MAX(expires_at)` 경과 후 삭제·잔여 0 증적이 나올 때까지 정리를 유지한다. 관찰 종료 직후 예약을 끄지 않는다.

## 통합 테스트

`POTION_TEST_DATABASE_URL`이 있고 host가 loopback, DB 이름이 `potion_test`인 폐기용 PostgreSQL에서만 실행한다. 해당 URL이 없어서 건너뛴 테스트는 통과 증거가 아니다. CI는 PostgreSQL16 서비스를 생성하고 suite를 `--maxWorkers=1`로 직렬 실행한다.

```powershell
npm test -- app/lib/analytics/potion-db.test.ts app/lib/analytics/potion-summary.test.ts app/lib/analytics/potion-maintenance.test.ts --maxWorkers=1
```

운영 DB/자격 증명을 복사하거나 운영 자료로 삭제·중복·경계 테스트를 하지 않는다.
