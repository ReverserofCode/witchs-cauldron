# 팬아트 허락·검수 게시 운영 가이드

## 범위와 원칙

관리자 화면은 `/admin/fanart`다. 원문 등록 → 허락 요청문 복사 → 운영자가 직접 요청 → 동의·제작 방식 확인 기록 → 파일 업로드 → 게시 승인 순서로 운영한다. 팬카페 자동 수집, 로그인 우회, AI 판별기, 메시지 자동 발송은 구현하지 않았다. 테스트에는 자체 제작 단색 도형만 사용했다.

생성형 AI 미사용은 **작가의 확인과 운영자 검수**를 각각 기록한다. 사이트가 제작 방식을 자동 인증한다는 뜻이 아니다. 답변이 없거나 불명확하면 게시하지 않는다. 연락처·비밀번호·전체 대화 등 불필요한 개인정보를 증빙 메모에 입력하지 않는다.

## 필수 설정

```dotenv
ADMIN_BASIC_AUTH_USERNAME=<operator-name>
ADMIN_BASIC_AUTH_PASSWORD=<strong-private-password>
FANART_ALLOWED_ORIGIN=https://moingfans.com
FANART_DATABASE_URL=postgres://<user>:<password>@<host>:5432/<database>
FANART_ASSETS_DIR=/app/data/fanart
```

- `FANART_DATABASE_URL`이 비어 있으면 명시적으로 설정된 `ANALYTICS_DATABASE_URL`, 다음으로 `DATABASE_URL`을 사용한다. 세 값 모두 없으면 DB 기능은 503으로 닫힌다. 기본 자격증명을 자동 추정하지 않는다. 기존 PostgreSQL을 함께 사용해도 팬아트 전용 테이블만 생성한다.
- `FANART_ALLOWED_ORIGIN`은 실제 브라우저 주소의 origin과 정확히 같아야 한다(끝 슬래시 제외). 호스트명·프로토콜·포트가 다르면 변경 요청은 403이다. 개발 기본값은 `http://localhost:3000`, 운영 Compose 기본값은 `https://moingfans.com`이다.
- 관리자 자격증명이 없으면 개발 환경에서도 신규 관리자 페이지/API를 비활성화한다. HTTPS를 사용하고 비밀번호는 Git·문서에 저장하지 않는다.
- 최초 DB 접근 때 전용 테이블 `fanart_works`, `fanart_audit_events`와 인덱스를 생성하므로 해당 DB 계정에 필요한 DDL 권한이 있어야 한다. 기존 Analytics 테이블은 변경하지 않는다.
- 세 Compose 구성 모두 `fanart_assets:/app/data/fanart`를 마운트한다. 새 볼륨은 Docker 이미지의 UID/GID 1001 디렉터리 소유권을 상속한다. 기존/bind 볼륨은 운영자가 해당 경로의 권한을 별도 확인해야 한다. 로컬 npm 개발 기본 저장소는 `frontend/.data/fanart`이며 Git 및 Docker 빌드 컨텍스트에서 제외된다.

## 운영 순서

1. 지원 원문 URL, 제목, 작가 표기명을 확인하고 후보로 등록한다. URL은 `https://cafe.naver.com/moinge/<글번호>` 또는 `https://cafe.naver.com/f-e/cafes/30182989/articles/<글번호>`만 지원하며 쿼리/해시를 제거해 같은 글 중복을 막는다.
2. 요청문을 복사해 운영자가 작가에게 직접 전달한다. 허락 요청 여부를 기록한다. 게시·리사이즈 및 WebP 변환·출처 표기 범위를 각각 확인한다.
3. 허락 확인일과 최소한의 증빙, 작가의 생성형 AI 미사용 확인일, 운영자 검수 상태·검수일을 기록한다. 세 가지 동의와 두 확인이 모두 있어야 업로드할 수 있다.
4. 허락받은 PNG/JPEG/WebP 정지 이미지를 업로드한다. 최대 10 MiB, 2천만 픽셀이다. 최대 긴 변 1600px로 축소(확대하지 않음), 메타데이터를 제거하고 WebP로 변환한다. 변환 결과는 최대 5 MiB다. JSON 32 KiB, multipart 요청 전체 11 MiB 제한도 적용한다.
5. `게시 승인`을 누르면 작업실에 표시된다. 처음 파일 등록은 기존 확인에 연결되지만, **파일 교체는 작가 확인·운영자 검수를 초기화**하므로 두 확인을 다시 기록해야 한다.
6. 철회 요청을 받으면 작품명을 확인하고 `게시 철회`한다. 새 이미지 요청은 즉시 404가 된다. 기존 열린 갤러리는 포커스 복귀 또는 보이는 동안 60초 간격으로 갱신된다. 이미 받은 사본/현재 화면 픽셀까지 회수할 수는 없다.

후보·허락 요청·게시 준비 상태는 거절할 수 있다. 게시된 작품의 허락/검수/파일은 편집할 수 없다. 철회·거절은 이 버전에서 되돌릴 수 없으며 원문 중복 방지 기록을 유지한다. 제목·작가명·원문은 등록 후 수정할 수 없으므로 오등록은 거절 후 별도의 수정 기능이 필요하다. 다른 관리자의 변경과 충돌하면 409 안내에 따라 상세를 새로고침하고 다시 확인한다.

## 공개 API와 이미지 노출

| 경로 | 동작 |
|---|---|
| `GET /api/admin/fanart?status=&offset=0&limit=20` | 인증된 후보 목록, 최대 50개 |
| `POST /api/admin/fanart` | 후보 등록 `{sourceUrl,title,credit}` |
| `GET /api/admin/fanart/[id]` | 상세 및 처리 기록 |
| `PATCH /api/admin/fanart/[id]` | `{version,review:{requested,permission,review}}` 저장 |
| `POST /api/admin/fanart/[id]/asset` | multipart `version`, `file` |
| `POST /api/admin/fanart/[id]/publish`, `/withdraw`, `/reject` | `{version}`으로 상태 변경 |
| `GET /api/fanart` | 최신 게시 작품 최대 24개 |
| `GET /media/fanart/[id]` | 현재 게시 상태·승인 해시·저장 파일 해시를 확인하고 전송 |

모든 신규 API/media 응답은 `no-store`다. 공개 필드는 `id,src,alt,credit,sourceUrl,publishedAt`뿐이다. 허락 증빙과 검수 메모는 공개하지 않는다. 신규 이미지는 Next 이미지 최적화 캐시에 넣지 않으며 수동으로 만든 최적화 요청도 400으로 거절한다. 별도 다운로드 기능은 제공하지 않는다. CDN/리버스 프록시는 `/api/fanart`, `/media/fanart/*`, `/api/admin/fanart/*`의 no-store를 덮어쓰지 않도록 확인한다.

DB 또는 목록 요청이 실패하면 이전에 받은 목록을 유지할 수 있지만, 미디어 요청은 DB 장애 시 503으로 닫힌다. 기존 정적 팬아트는 별도 legacy 항목으로 유지하며 신규 허락·검수 표식을 붙이지 않는다. **기존 정적 이미지의 철회는 정적 파일 및 기존 캐시를 별도로 처리해야 한다.**

## 백업·복구·롤백

- DB와 `fanart_assets` 볼륨을 한 쌍으로 백업한다. DB에는 비공개 증빙이 있으므로 백업도 접근 통제·보관 정책을 적용한다.
- 일관된 백업은 관리자 변경/업로드를 중단한 상태에서 전용 테이블을 포함한 PostgreSQL 백업과 볼륨 스냅샷을 함께 생성한다. 복구 시 같은 시점의 DB/볼륨을 함께 되돌리고 UID1001(nextjs)의 접근권한, 게시 이미지200·철회 이미지404를 확인한 다음 쓰기를 재개한다.
- 교체 이전 파일과 철회 파일은 자동 삭제하지 않는다. 감사 기록과 복구를 위해 유지하며 용량/보관기한을 별도 관리한다. DB가 참조하는 파일을 임의로 지우지 않는다.
- 애플리케이션 롤백 시 이전 이미지로 되돌려도 DB/볼륨을 삭제하지 않는다. `docker compose down -v`, 광범위한 prune은 사용하지 않는다. 다시 신규 버전을 실행할 때 보존한 DB/볼륨을 연결한다.
- 공개 미디어 파일이 변조되거나 유실되면 해시 검증 때문에 노출되지 않는다. 원인을 조사하고 검증된 백업에서 복구한다. 승인 해시를 임의 변경해 우회하지 않는다.

## 로컬 검증과 CI

`npm run smoke:fanart`는 loopback 전용 앱과 `FANART_SMOKE_ALLOW_WRITES=true`가 필요하다. 지정 DB에 자체 도형 후보를 작성·게시·철회한다. 실제 운영 데이터베이스를 연결한 앱에 실행하면 안 된다. CI는 일회성 `fanart_test` DB로 저장소 통합 테스트와 브라우저 흐름을 실행한다. DB 통합 테스트는 loopback의 명시적 `FANART_TEST_DATABASE_URL`만 받고 테스트별 schema를 정리한다.

컨테이너 재생성 검증은 `scripts/smoke-fanart-persistence.mjs seed`, 테스트 frontend 컨테이너만 동일 DB/볼륨을 유지해 재생성, `... verify` 순서다. 양쪽에 같은 숫자형 `FANART_PERSISTENCE_RUN_ID`를 전달한다. 검증 후 게시 테스트 작품도 철회한다.

이 작업에서는 운영 배포·푸시를 하지 않았다. 실제 검증 결과는 `FANART_IMPLEMENTATION_TEST_REPORT_2026-09-18.md`에 기록한다.
