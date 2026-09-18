# 팬아트 승인형 게시 기능 운영 배포 기록

작업일: 2026-09-18 (Asia/Seoul). 사용자 요청: “배포 진행해”.
상태: 운영 CD 진행 중. 최종 결과는 아래에 기록한다.

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

보완 배포 결과: 진행 중.
