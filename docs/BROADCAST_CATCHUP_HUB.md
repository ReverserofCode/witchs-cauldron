# 방송 모아보기 운영 가이드

`/broadcasts`는 모잉 다시보기 채널의 분할 업로드를 실제 방송 날짜별로 묶어 보여 주는 따라잡기 페이지입니다.

## 제공 기능

- 최근 12주 다시보기 수집
- 제목 날짜 기준 방송 세션 그룹화
- 방송별 파트 수, 총 길이, 카테고리, 합방 상대 표시
- 전체 / 시청 전 / 새 방송 필터
- 브라우저별 시청 상태와 마지막 방문 기록
- 다시보기 클릭 분석

원본 데이터는 YouTube 채널 `@fullmoing`의 공개 업로드입니다.

## 필요한 환경 변수

```bash
YOUTUBE_API_KEY=your_youtube_data_api_key
```

키는 서버에서만 사용합니다. 키가 없거나 YouTube가 일시적으로 응답하지 않으면 `/broadcasts`는 오류를 발생시키는 대신 원본 다시보기 채널 링크가 있는 대체 화면을 보여 줍니다.

Docker 이미지는 API 키 없이 빌드되고 실행 시점에 키를 주입하므로 페이지는 요청 시점에 렌더링합니다. YouTube 요청 자체에는 15분 데이터 캐시를 적용해 페이지 방문마다 할당량을 소비하지 않습니다.

## 데이터 갱신 정책

| 항목 | 정책 |
|---|---|
| 업로드 플레이리스트 | 요청당 50개, 최대 3페이지 |
| 수집 범위 | 현재 시각 기준 84일 |
| YouTube fetch 재검증 | 15분 |
| 페이지 렌더링 | 런타임 렌더링, YouTube 데이터 캐시 재사용 |
| 영상 상세 조회 | 영상 ID 50개씩 배치 |
| 외부 요청 제한 시간 | 요청당 8초 |
| 부분 실패 | 성공한 페이지와 영상은 유지 |

다시보기 채널 ID는 `UC2fJutQqQRGmlbqiAYFsBuQ`, 업로드 플레이리스트 ID는 `UU2fJutQqQRGmlbqiAYFsBuQ`입니다.

## 제목 인식 규칙

권장 제목 예시:

```text
[26.08.02] 게임 1부 (w. 통깡이, 여까) 【게임명】
```

- `[YY.MM.DD]` 또는 `[YYYY.MM.DD]`: 실제 방송일
- `【...】`: 카테고리
- `(w. ...)` 또는 `(with ...)`: 합방 상대

날짜 접두사가 없거나 유효하지 않으면 YouTube의 실제 영상 게시 시각(`contentDetails.videoPublishedAt`)을 서울 날짜로 바꾸어 사용하며, 화면에 “업로드일 기준”이라고 표시합니다. 같은 날짜의 영상은 하나의 방송으로 묶입니다. 현재 서울 날짜보다 미래인 제목 날짜는 잘못된 입력으로 보고 목록에서 제외합니다.

## 브라우저 저장 데이터

사용자 계정이나 서버 사용자 테이블은 사용하지 않습니다.

| localStorage 키 | 내용 |
|---|---|
| `wc:broadcasts:watched:v1` | 시청한 방송 세션 ID 배열 |
| `wc:broadcasts:last-visited:v1` | 직전 방문 ISO 시각 |

브라우저 데이터를 지우거나 다른 기기를 사용하면 시청 상태가 동기화되지 않습니다. 저장소 접근이 차단되어도 다시보기 목록과 외부 링크는 계속 사용할 수 있습니다.

## 분석 이벤트

다시보기 링크를 열면 기존 `/api/analytics/track`으로 `content_click` 이벤트를 보냅니다.

- `element.type`: `broadcast_replay`
- `element.id`: `<방송일>:<YouTube 영상 ID>`
- `element.label`: 정리된 파트 제목
- `metadata.location`: `broadcast_hub`

시청 여부는 분석 서버에 전송하지 않습니다.

## 주요 파일

| 역할 | 경로 |
|---|---|
| 페이지 | `frontend/app/broadcasts/page.tsx` |
| 클라이언트 허브 | `frontend/app/components/broadcasts/BroadcastHub.tsx` |
| 타입 | `frontend/app/lib/broadcasts/types.ts` |
| 제목 정규화·그룹화 | `frontend/app/lib/broadcasts/normalize.ts` |
| YouTube 수집 | `frontend/app/lib/broadcasts/youtube.ts` |
| 서버 환경 경계 | `frontend/app/lib/broadcasts/server.ts` |
| 로컬 시청 상태 | `frontend/app/lib/broadcasts/progress.ts` |

## 로컬 검증

`frontend` 디렉터리에서 실행합니다.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

브라우저 확인:

1. `/broadcasts`가 열리고 헤더의 “방송 모아보기”가 같은 탭으로 이동하는지 확인합니다.
2. 시청 상태를 바꾼 뒤 새로고침하여 유지되는지 확인합니다.
3. 전체 / 시청 전 / 새 방송 필터의 개수와 결과가 맞는지 확인합니다.
4. 다시보기 링크가 올바른 YouTube 영상으로 새 탭에서 열리는지 확인합니다.
5. 모바일 폭에서 카드와 파트 제목이 화면 밖으로 넘치지 않는지 확인합니다.

## 장애 확인

### 목록 전체가 준비 중으로 표시될 때

1. 실행 환경에 `YOUTUBE_API_KEY`가 있는지 확인합니다. 키 값을 로그에 출력하지 마세요.
2. 컨테이너를 환경 변수와 함께 다시 생성했는지 확인합니다.
3. YouTube Data API v3가 해당 Google Cloud 프로젝트에서 활성화되어 있는지 확인합니다.
4. 로그의 `[broadcasts] YouTube source request failed` 항목에서 단계(`playlist`/`duration`), 요청 순번, HTTP 상태나 오류 이름을 확인합니다. 로그에는 API 키와 요청 URL을 남기지 않습니다.

### 일부 정보 안내가 표시될 때

플레이리스트 후속 페이지 또는 영상 길이 상세 요청의 일부가 실패한 상태입니다. 성공한 콘텐츠는 그대로 사용할 수 있으며, 15분 재검증 뒤 자동으로 다시 시도합니다.

### 영상이 잘못 묶일 때

원본 영상 제목의 방송 날짜 접두사를 먼저 확인합니다. 날짜가 없는 영상은 업로드일 기준으로 묶이므로 실제 방송일과 다를 수 있습니다. 자동 보정 UI는 MVP 범위에 포함되지 않습니다.

## 설계 문서

- 설계: `docs/superpowers/specs/2026-08-05-broadcast-catchup-hub-design.md`
- 구현 계획: `docs/superpowers/plans/2026-08-05-broadcast-catchup-hub.md`
