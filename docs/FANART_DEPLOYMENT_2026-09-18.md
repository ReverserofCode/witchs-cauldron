# 팬아트 승인형 게시 기능 운영 배포 기록

작업일: 2026-09-18 (Asia/Seoul). 사용자 요청: “배포 진행해”.
상태: 운영 배포 및 읽기 전용 검증 완료 (2026-09-18 22:09 KST).

## 대상과 범위

- 운영 URL: https://moingfans.com
- PR: [#8](https://github.com/ReverserofCode/witchs-cauldron/pull/8)
- 검증된 기능 브랜치 head: `0ce4991eb19a9c21ec5a841a2a04740cddd788e5`
- main 병합 SHA: `5563f227926126811b46e42824b013a7cb618373`
- 팬아트 허락 기록·검수·업로드·게시·철회 및 갤러리 갱신을 운영에 반영한다. 팬카페 자동 수집, 작가 메시지 발송, 승인 없는 이미지 가져오기, 실제 작품 임의 게시를 포함하지 않는다.
- 원래 체크아웃과 네 개의 미커밋 문서를 변경하지 않았다.

## 사전 검증

- 배포 전 홈페이지와 `/api/health`는200, `/api/fanart`와 `/api/admin/fanart`는404였다.
- [PR CI 35346815381](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/35346815381): test와 docker-image 모두 성공. 실제 일회성 PostgreSQL을 사용한 팬아트69개 테스트 및 게시/철회/모달 회귀 브라우저 흐름 통과.
- 로컬 구현 검증은 [검증 보고서](FANART_IMPLEMENTATION_TEST_REPORT_2026-09-18.md)에 기록했다: 전체257개 통과·건너뛰기0, 타입검사/Node22 Docker 빌드/재생성 보존 검증 통과, lint오류0·기존경고22.
- [운영 읽기 전용 사전 점검 35346919266](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/35346919266): 성공. 배포 전 서버 SHA0483162, frontend/backend/analytics-db 모두healthy, 기존 클립49개, 자동 클립 수집 비활성 확인.
- 로컬 SSH 접속에 필요한 비밀 정보를 출력하거나 Git에 추가하지 않았다. 기존 GitHub production 환경의 인증·host fingerprint 검증을 사용하는 배포 파이프라인을 이용했다.

## 배포와 복구 원칙

- [CD 35347066756](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/35347066756)에서 병합 SHA를 빌드·검증한 뒤 기존 배포 스크립트를 실행한다.
- 기존 스크립트는 이전 frontend/backend 이미지에 rollback 태그를 붙이고 새 이미지를 빌드한 다음 컨테이너를 교체한다. 무중단 배포를 보장하지 않는다.
- DB·클립 볼륨을 삭제하는 `down -v`는 실행하지 않는다. 신규 `fanart_assets` 볼륨은 `/app/data/fanart`에 별도로 연결한다.
- 운영에서 합성 작품/허락 데이터나 Analytics 이벤트를 생성하지 않는다. 게시·철회 쓰기 검증은 일회성 로컬/CI 환경에서 수행한 결과와 구분한다.

## 배포 후 결과

첫 CD는 기존 검증 기준으로 성공했지만 팬아트 공개 API가503이었다. 응답 `작품 저장소를 사용할 수 없습니다.`는 저장소 코드의 명시적 DB 환경변수 전부 누락 분기에서만 발생한다. 기존 Analytics는 내부 DB 기본 연결 후보가 있어 정상이어도 이 누락을 발견하지 못했다.

운영 설정 보완:

- 세 Compose 구성에 기존 내부 DB 연결을 명시적으로 전달한다. 우선순위는 FANART_DATABASE_URL → ANALYTICS_DATABASE_URL → Compose에 정의된 analytics-db다. 애플리케이션 자체의 미설정 fail-closed 정책은 변경하지 않는다.
- 실제 `docker compose config`를 실행하는9개 회귀 테스트에서 기본 설정3개가 먼저 실패했고, 수정 후9개 모두 통과했다. 외부/전용 DB 오버라이드가 우선함도 검증한다.
- PR CI에 Compose 검증을 추가하고, CD에 팬아트 공개 API200/no-store/공개 필드 제한 및 관리자 무인증401·인증200을 검사하는 읽기 전용 검증을 추가했다. 작품 등록/게시/업로드는 하지 않는다.

보완 배포 결과:

- [설정 보완 PR #9](https://github.com/ReverserofCode/witchs-cauldron/pull/9) 병합 완료. 최종 운영 SHA: `050892158b2581bc4115a5e340e38eccb6468a57`.
- [보완 CI 35347778317](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/35347778317): test·docker-image 모두 성공. Compose 9개 검증, 팬아트 DB 통합 테스트, 격리 DB 브라우저 회귀 테스트 통과.
- 독립 배포 설정 리뷰에서 Critical/Important 지적 없음. CI docker-image 작업의 Node 버전을 명시적으로 고정하는 제안은 비차단 후속 개선 사항이다.
- [최종 CD 35348090237](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/35348090237): build-and-test·deploy 모두 성공. 서버 체크아웃 SHA가 최종 운영 SHA와 일치하고 컨테이너 헬스체크 및 기존 Analytics 인증 조회 검증을 통과했다.
- 새 CD 검증에서 공개 팬아트 목록 200/no-store, 무인증 관리자 API 401, 인증 관리자 API 200/no-store 및 응답 구조를 확인했다. 인증 정보와 비공개 응답 본문은 출력하지 않았다.

실제 운영 URL에 별도로 GET 요청해 확인한 결과:

| 경로 | 결과 |
|---|---|
| `/` | 200, 팬 커뮤니티 작업실 마크업 존재 |
| `/api/health` | 200 |
| `/api/fanart` | 200, no-store, `images: []` |
| `/admin/fanart`, `/api/admin/fanart` (무인증) | 401, Basic Auth challenge, private/no-store |
| `/media/fanart/<존재하지 않는 UUID>` | 404, no-store |
| 신규 팬아트 경로를 지정한 `/_next/image` 요청 | 400 (최적화 캐시 우회 차단) |
| `/broadcasts`, `/games/potion-timing` | 200 |

## 운영 인계와 검증 한계

- 초기 배포의 팬아트 503은 설정 보완 후 같은 공개 API의 200 응답으로 해소를 확인했다.
- 신규 게시 작품은 검증 시점에 0개다. 빈 목록에서는 실제 작품의 공개 필드나 이미지 렌더링을 운영에서 검증한 것이 아니다. 게시·철회·권한·파일 보존 흐름은 일회성 테스트 환경에서 검증했다.
- 실제 작가의 허락이나 작품을 임의로 등록하지 않았고, 운영에서 업로드·게시·철회 요청을 실행하지 않았다. 운영 쓰기 흐름의 종단 간 확인은 첫 실제 허락 작품을 관리자가 게시할 때 필요하다.
- 팬카페의 댓글/메시지에서 허락을 자동 감지하거나 이미지를 자동 수집하지 않는다. [관리자 화면](https://moingfans.com/admin/fanart)에서 원문 후보 → 동의·비AI 제작 확인·운영자 검수 기록 → 파일 업로드 → 게시 승인을 완료하면 공개 목록에 나타나고 갤러리가 갱신된다.
- 작업 절차·동의 범위·철회·백업 정책은 [운영 가이드](FANART_PERMISSION_WORKFLOW.md)를 따른다. DB와 `fanart_assets` 볼륨을 함께 백업해야 한다.
