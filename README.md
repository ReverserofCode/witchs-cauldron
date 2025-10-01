# Frontend (Next.js + Tailwind v4)

이 패키지는 Docker 컨테이너에서 실행되는 Next.js 14 + React 18 프론트엔드입니다. Tailwind CSS v4를 사용하며 PostCSS 플러그인은 `@tailwindcss/postcss`만 필요합니다.

## 현재 상태

- Next.js dev 서버가 http://localhost:3000 에서 정상 동작합니다.
- Tailwind v4 구성으로 마이그레이션 완료:
  - `postcss.config.js`는 `@tailwindcss/postcss`만 사용합니다.
  - `autoprefixer`는 제거되었습니다(Tailwind v4에 내장).
  - 불필요한 `tailwind.config.js`는 제거 대상이나 커스텀 설정이 없어도 동작합니다.
- 샘플 경로:
  - `/` 홈 페이지
  - `/test` 테스트 페이지
  - `/api/health` 헬스체크 API (200 응답 시 정상)

## 개발 환경 실행

프로젝트 루트의 docker-compose를 사용하세요.

```cmd
docker compose up -d --build
```

로그 확인:

```cmd
docker logs -f --tail=200 witchs-cauldron-frontend
```

종료:

```cmd
docker compose down
```

> Windows/OneDrive 환경 안정화를 위해 파일 변경 감지 폴링이 활성화되어 있습니다.

## 패키지 설치/명령 실행 (컨테이너 내부)

로컬 호스트에서 직접 npm을 실행하지 말고 컨테이너를 통해 실행하세요.

```cmd
docker exec -it witchs-cauldron-frontend npm install <pkg>
docker exec -it witchs-cauldron-frontend npm run dev
docker exec -it witchs-cauldron-frontend npm run build
docker exec -it witchs-cauldron-frontend npm run start
```

타입 체크:

```cmd
docker exec -it witchs-cauldron-frontend npx tsc --noEmit
```

## Tailwind CSS (v4)

- 전역 스타일: `app/globals.css`
- PostCSS 구성: `postcss.config.js`
- 별도의 `tailwind.config.js`가 없어도 동작합니다(필요 시 생성하여 테마/플러그인 확장 가능).

## 트러블슈팅

- 에러: `It looks like you're trying to use tailwindcss directly as a PostCSS plugin` 발생 시
  - `postcss.config.js`에 `@tailwindcss/postcss`만 남겨두세요.
  - `autoprefixer`를 의존성에서 제거하고 재설치하세요.
  - 컨테이너 재시작 후 캐시가 남아있다면 `rm -rf .next && npm ci`를 컨테이너에서 실행하세요.

## 스크립트

- `npm run dev`: 개발 서버
- `npm run build`: 빌드
- `npm run start`: 프로덕션 서버

## 디렉터리

- `app/` Next.js App Router 소스
  - `layout.tsx` 글로벌 폰트, AppShell, 공통 메타데이터
  - `page.tsx` 홈 화면 섹션 컴포넌트 조합
  - `test/page.tsx` 셋업 확인용 샌드박스 페이지
  - `api/health/route.ts` 헬스체크 엔드포인트
- `components/layout/` 헤더, 푸터, 페이지 헤더 등 공용 레이아웃 컴포넌트
- `components/home/` 홈 화면 전용 섹션 컴포넌트
- `components/ui/Container.tsx` 공용 레이아웃 컨테이너
- `config/navigation.ts` 내비게이션 및 리소스 카드 정의
- `postcss.config.js` Tailwind v4 PostCSS 설정

## 프론트엔드 기본 구조

- 글로벌 레이아웃(AppShell)과 SiteHeader/SiteFooter로 페이지 공통 UI를 구성합니다.
- PageHeader 컴포넌트로 페이지 단위 헤더를 재사용합니다.
- HomeHero, ResourceGrid 등 섹션 단위 컴포넌트로 홈 화면을 모듈화합니다.
- `config/navigation.ts`에서 내비게이션과 리소스 링크를 중앙 집중 관리합니다.

## GPT API 컨테이너(gpt-codex) 연동

개발용 GPT 백엔드 컨테이너(`gpt-codex`)가 포함되어 있습니다. 호스트 및 프런트에서 쉽게 사용할 수 있도록 프록시/포트 노출이 구성되어 있습니다.

### 실행/재빌드

```cmd
:: gpt-codex만 클린 빌드
docker compose build --no-cache gpt-codex

:: gpt-codex만 실행
docker compose up -d gpt-codex

:: 전체 서비스 실행
docker compose up -d
```

### 상태/로그/헬스체크

```cmd
:: 상태 확인
docker compose ps

:: gpt-codex 로그 팔로우
docker compose logs -f gpt-codex

:: 호스트에서 헬스 체크 (컨테이너 직접)
curl http://localhost:8080/health

:: 프런트 프록시 경유 (개발 모드에서만)
curl http://localhost:3000/api/gpt/health
```

### 컨테이너 내부 작업

```cmd
:: 쉘 접속 (bash 또는 sh)
docker exec -it gpt-codex bash
:: 또는
docker exec -it gpt-codex sh

:: 패키지 설치 (볼륨 마운트된 /srv 기준)
docker exec -it gpt-codex npm install <패키지명>

:: 글로벌 패키지(@openai/codex) 확인
docker exec -it gpt-codex npm ls -g @openai/codex

:: codex 바이너리 확인
docker exec -it gpt-codex codex --help
```

### 프런트에서 호출 (CORS 회피 프록시)

개발 모드에서 Next.js가 `/api/gpt/:path*`를 Docker 네트워크의 `gpt-codex:8080`으로 프록시합니다. 프런트 코드는 `/api/gpt/...`로 호출하세요.

예시:

```ts
// 브라우저 측 코드
const res = await fetch("/api/gpt/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "hello" }),
});
const data = await res.json();
```

### 환경 변수(.env)

루트의 `.env` 파일이 `gpt-codex`에 주입됩니다.

```env
OPENAI_API_KEY=sk-...
NODE_ENV=development
```

민감값은 저장소에 커밋하지 마세요. 필요 시 `docker-compose.yml`에서 `env_file`로 경로를 조정할 수 있습니다.

### 엔드포인트

- `GET /health` → `{ ok: true, service: 'gpt-codex', hasOpenAIKey: boolean }`
- `GET /env-check` → `{ hasOpenAIKey: boolean }`
- `POST /chat` → 개발용 에코 응답

직접 접근: `http://localhost:8080/...`

프록시 경유: `http://localhost:3000/api/gpt/...`
