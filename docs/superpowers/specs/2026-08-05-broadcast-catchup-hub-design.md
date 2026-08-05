# 방송 단위 따라잡기 허브 설계

- 상태: 승인됨
- 작성일: 2026-08-05
- 대상 프로젝트: 마녀의 포션 공방
- 기능 경로: `/broadcasts`

## 1. 배경과 근거

2026-08-05 조사 시점의 모잉 콘텐츠는 다음 특성을 보였다.

- 치지직 최근 공개 다시보기는 회당 길이가 긴 편이고, 최근 25개 기준 평균 약 5.5시간·중앙값 약 5시간이었다.
- 공식 YouTube는 업로드 빈도가 낮지만 다시보기 채널 `@fullmoing`은 한 번의 방송을 여러 영상으로 나눠 비교적 자주 업로드한다.
- 기존 사이트는 최신 영상, 인기 영상, 숏폼, 일정과 팬아트를 잘 보여 주지만, 같은 방송에서 나온 여러 다시보기를 하나의 에피소드로 묶지는 않는다.
- 팬은 “어떤 방송을 놓쳤는지”, “이 방송은 몇 편으로 나뉘었는지”, “어디까지 봤는지”를 현재 화면만으로 판단하기 어렵다.

조사 기준 링크:

- 치지직: <https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e>
- 공식 YouTube: <https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ>
- 다시보기 YouTube: <https://www.youtube.com/@fullmoing>

## 2. 목표

최근 12주 다시보기 영상을 실제 방송 날짜 단위로 묶어, 사용자가 짧은 시간 안에 놓친 방송을 찾고 이어서 볼 수 있게 한다.

성공 조건:

1. 같은 날짜 접두사를 가진 분할 영상이 하나의 방송 세션으로 표시된다.
2. 세션마다 총 재생 시간, 영상 수, 카테고리와 합방 상대를 확인할 수 있다.
3. 사용자는 계정 없이 세션을 “시청함/시청 전”으로 관리할 수 있다.
4. 두 번째 방문부터 지난 방문 이후 추가된 세션을 구분할 수 있다.
5. YouTube API 키 누락이나 일시 장애가 전체 사이트 오류로 전파되지 않는다.

## 3. 범위

### MVP에 포함

- 별도 `/broadcasts` 페이지
- `@fullmoing` 업로드 최대 3페이지(최대 150개) 수집
- 최근 12주 데이터만 노출, 최신 방송 우선 정렬
- 제목의 `[YY.MM.DD]` 또는 `[YYYY.MM.DD]` 접두사 기반 방송일 파싱
- 제목의 `【카테고리】`, `(w. 게스트)` 메타데이터 파싱
- 동일 방송일 영상 그룹화와 총 길이 합산
- 전체 / 시청 전 / 새 방송 보기 필터
- `localStorage` 기반 시청 상태와 마지막 방문 시각
- YouTube 영상 이동 클릭 분석
- 헤더의 내부 페이지 진입점
- 빈 결과·API 키 누락·외부 API 장애 상태

### MVP에서 제외

- 로그인 및 서버 동기화
- 댓글, 좋아요, 개인 추천
- AI 자막 요약과 장면 검색
- 치지직 VOD/클립의 신규 자동 수집
- 운영자용 수동 세션 병합 UI
- 본문 검색 및 고급 카테고리 분류

## 4. 사용자 흐름

1. 사용자가 헤더의 “방송 모아보기”를 선택한다.
2. 최신 방송 세션이 날짜순으로 보인다.
3. 카드에서 방송일, 분할 영상 수, 총 길이, 주제와 합방 정보를 훑는다.
4. 보고 싶은 파트를 YouTube에서 연다.
5. 해당 방송을 다 봤다면 “시청함”으로 표시한다.
6. 다음 방문에는 새로 추가된 방송과 아직 보지 않은 방송만 걸러 본다.

## 5. 데이터 모델

```ts
type BroadcastDateSource = "title" | "publishedAt";

interface BroadcastAsset {
  videoId: string;
  title: string;
  displayTitle: string;
  url: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
  category: string | null;
  collaborators: string[];
  broadcastDate: string;
  dateSource: BroadcastDateSource;
}

interface BroadcastSession {
  id: string;
  broadcastDate: string;
  dateSource: BroadcastDateSource;
  assets: BroadcastAsset[];
  totalDurationSeconds: number;
  categories: string[];
  collaborators: string[];
  latestPublishedAt: string;
}
```

세션 ID는 `broadcast-YYYY-MM-DD` 형식이다. 제목에서 방송일을 찾지 못한 영상은 업로드 시각을 서울 날짜로 바꾸어 대체하고, UI에서 “업로드일 기준”으로 명시한다.

## 6. 제목 정규화 규칙

예상 입력:

```text
[26.08.02] 게임 1부 (w. 통깡이, 여까) 【게임명】
```

처리 순서:

1. 맨 앞 날짜 접두사를 파싱하고 화면용 제목에서 제거한다.
2. `【...】`의 마지막 값을 카테고리로 사용한다.
3. `(w. ...)`, `(with ...)` 안의 쉼표·가운뎃점 구분 이름을 합방 상대 목록으로 만든다.
4. 메타데이터 표기를 제거한 나머지를 파트 제목으로 사용한다.
5. 빈 제목이 되면 원본 제목을 안전한 대체값으로 사용한다.

파싱은 순수 함수로 구현하고 실제 관찰 패턴과 예외 입력을 단위 테스트한다.

## 7. 데이터 수집과 캐시

서버 컴포넌트가 내부 HTTP API를 다시 호출하지 않고 서버 데이터 함수 `getBroadcastArchive()`를 직접 호출한다.

데이터 흐름:

```text
YouTube uploads playlist
  -> playlistItems 페이지 조회(최대 3회)
  -> videos 상세 조회(50개씩, 길이 확보)
  -> 제목 정규화
  -> 최근 12주 필터
  -> 방송일 그룹화
  -> /broadcasts 서버 컴포넌트
  -> 클라이언트 시청 상태 결합
```

- 다시보기 채널 ID: `UC2fJutQqQRGmlbqiAYFsBuQ`
- 업로드 플레이리스트 ID: 채널 ID의 `UC`를 `UU`로 바꾼 `UU2fJutQqQRGmlbqiAYFsBuQ`
- YouTube 응답 캐시: 15분 재검증
- 페이지 렌더링: Docker 런타임 환경 변수를 읽기 위해 요청 시점에 렌더링
- 데이터 재검증: 각 YouTube fetch를 15분 캐시
- 요청 제한 시간: YouTube 요청마다 8초, 영상 길이 배치는 병렬 조회
- 페이지당 최대 항목: 50
- 최대 페이지: 3
- 노출 기간: 현재 시각 기준 84일

API 키는 서버에서만 읽으며 클라이언트 응답과 HTML에 포함하지 않는다.

## 8. 클라이언트 상태

키:

- `wc:broadcasts:watched:v1`: 시청한 세션 ID 배열
- `wc:broadcasts:last-visited:v1`: 이전 방문 ISO 시각

정책:

- 첫 방문에는 모든 콘텐츠를 “새 방송”으로 과장하지 않는다.
- 다시보기 목록이 정상 조회된(`status === "ready"`) 경우에만 기존 마지막 방문값을 이번 화면의 비교 기준으로 보존한 뒤 현재 시각을 저장한다. API 키 누락이나 일시 장애에서는 기준시각을 전진시키지 않는다.
- `latestPublishedAt`이 이전 방문 시각보다 늦은 세션만 “NEW”로 표시한다.
- 저장소 접근 실패·비활성 환경에서는 시청 기능만 일시적으로 동작하고 렌더링은 유지한다.

## 9. UI와 접근성

- 페이지 상단: 기능 설명, 수집 기준, 원본 채널 링크
- 요약: 방송 수, 전체 파트 수, 시청 전 수
- 필터: 전체 / 시청 전 / 새 방송
- 세션 카드: 날짜, 기준 표시, 총 길이, 파트 수, 카테고리, 합방 상대
- 파트 행: 썸네일, 제목, 길이, 업로드일, 외부 링크
- 시청 토글은 실제 `button`을 사용하고 `aria-pressed`를 제공한다.
- 필터에는 현재 선택 상태를 시각적 스타일과 `aria-pressed`로 함께 제공한다.
- 외부 링크는 새 탭에서 열고 이를 보조 문구로 알린다.
- 모바일에서는 한 열, 넓은 화면에서는 카드 내부 메타데이터와 파트 목록을 효율적으로 배치한다.

## 10. 분석

영상 링크 클릭 시 기존 `content_click` 이벤트를 사용한다.

```json
{
  "type": "content_click",
  "path": "/broadcasts",
  "element": {
    "type": "broadcast_replay",
    "id": "<broadcast date>:<youtube video id>",
    "label": "<display title>"
  },
  "metadata": {
    "location": "broadcast_hub"
  }
}
```

분석 계약이 허용하는 문자열 metadata 키만 사용한다. 방송일과 영상 ID는 `element.id`에 결합하며, 시청 상태는 개인 기기 안에만 남기고 분석 이벤트로 전송하지 않는다.

## 11. 실패 처리

- API 키 누락: 설정 안내가 아닌 사용자용 “다시보기 목록을 준비 중” 상태를 보여 준다.
- YouTube 비정상 응답: 이미 성공한 페이지가 있으면 부분 결과를 표시하고, 없으면 재시도 가능한 오류 상태를 표시한다.
- 길이 조회 누락: 해당 파트 길이를 0으로 두고 “길이 정보 없음”으로 표시한다.
- 비공개·삭제 영상: 영상 ID나 snippet이 없는 항목은 제외한다.
- 잘못된 날짜: 업로드일(서울 기준)로 대체하고, 미래 날짜로 해석되는 제목은 노출하지 않는다.

## 12. 검증 전략

1. 제목 날짜·카테고리·합방 파싱 단위 테스트
2. 날짜 없는 제목의 서울 업로드일 대체 테스트
3. 분할 영상 그룹화·중복 제거·정렬·총 길이 테스트
4. YouTube 페이지네이션과 오류/누락 길이 테스트
5. 로컬 시청 상태 직렬화 순수 함수 테스트
6. 전체 Vitest, TypeScript, ESLint, Next.js 프로덕션 빌드
7. 실제 브라우저에서 데스크톱·모바일 진입, 필터, 시청 토글, 외부 링크 확인

## 13. 향후 확장

- Chzzk VOD와 YouTube 다시보기의 교차 연결
- 방송 제목·게임·합방 상대 검색
- 파트별 시청 진행률
- 서버 계정 기반 여러 기기 동기화
- 운영자 수동 병합/분리 및 메타데이터 보정
