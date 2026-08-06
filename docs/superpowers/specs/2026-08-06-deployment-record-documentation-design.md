# 2026-08-06 배포 기록 문서화 설계

## 목적

2026-08-06에 완료한 `6154054` 배포의 준비, 실패 진단, 복구, 최종 검증 결과를 이후 운영자가 재현하고 판단할 수 있는 형태로 남긴다. 일반 배포 절차를 설명하는 README와 특정 실행의 사실을 보존하는 날짜별 기록을 분리한다.

## 선택한 구조

- `docs/DEPLOYMENT_RECORD_2026-08-06.md`를 새로 만들어 이번 배포의 상세 기록을 보존한다.
- README의 배포 가이드에는 상세 기록 링크와 현재 운영상 주의사항만 짧게 추가한다.
- 기존 `docs/ANALYTICS_OPERATIONS_RECORD_2026-07-09.md`는 Analytics 데이터 작업에 한정된 기록이므로 수정하지 않는다.

## 상세 기록 구성

1. 배포 식별 정보
   - 대상 커밋 `61540545527a5edff73610cea45ecb03e578c846`
   - GitHub Actions CD 실행 `31046763294`, 성공 attempt 2
   - 운영 URL과 배포 일자
2. 배포 전 준비
   - 로컬·원격 `main` 동기화 확인
   - 테스트, 타입 검사, 린트, Next.js 빌드, Docker 스모크 결과
   - GitHub `production` 환경과 `main` 배포 브랜치 정책 구성
   - SSH host key fingerprint secret 구성 원칙
3. 실행 과정
   - `main` 푸시와 CD 시작
   - 첫 attempt의 host key fingerprint mismatch
   - 서버가 여러 host key를 제공하고 클라이언트별 우선 알고리즘이 달랐던 원인
   - `drone-ssh`가 선택하는 ECDSA P-256 지문으로 교정한 뒤 실패 job 재실행
4. 최종 결과
   - build-and-test와 deploy job 성공
   - 서버가 정확한 커밋을 체크아웃
   - 프론트엔드·백엔드 health 및 인증된 Analytics 검증 통과
   - 재시도와 실제 rollback 미실행
5. 배포 후 외부 검증
   - 홈페이지, health, 방송 허브, 클립 카탈로그, Range, sitemap, 관리자 인증 경계
   - 방송 fallback·부분 데이터 경고가 없었던 사실
6. 운영 참고사항
   - `main` 직접 푸시가 자동 배포를 시작하는 현재 정책
   - required reviewer를 추가하면 예약 복구·유지보수도 승인 대기하게 되는 영향
   - GitHub에 `COLLECT_API_KEY` 또는 `CLIP_REFRESH_API_KEY`가 없어 서버의 기존 `.env`를 보존한 상태
   - `/api/health`는 프론트엔드 liveness만 증명한다는 제한

## 보안 및 기록 원칙

- SSH 비밀번호, API 키, Basic Auth 값, secret 원문을 기록하지 않는다.
- SSH fingerprint의 실제 값도 문서 본문에 복제하지 않고 key type, 확인 절차, GitHub secret 이름만 기록한다.
- GitHub Actions URL과 커밋 SHA처럼 감사에 필요한 공개 식별자는 기록한다.
- 실패 attempt가 운영 컨테이너 교체 전에 중단됐다는 사실과 최종 attempt에서 rollback이 실행되지 않았다는 사실을 구분한다.

## 검증 방법

- Markdown 링크와 명령 예시에 placeholder, secret 값, 모순이 없는지 검색한다.
- 기록된 SHA와 GitHub Actions run/attempt가 실제 결과와 일치하는지 확인한다.
- README 링크 대상이 존재하는지 확인한다.
- `git diff --check`로 공백 오류를 확인한다.

## 범위 제외

- 애플리케이션 코드, Docker Compose, GitHub Actions workflow 변경
- 운영 secret 회전 또는 branch protection 정책 변경
- 이미 완료한 배포의 재실행이나 추가 운영 API 호출
- 원격 푸시
