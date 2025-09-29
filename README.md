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
- `app/api/health/route.ts` 헬스체크 엔드포인트
- `app/test/page.tsx` 테스트 페이지
- `postcss.config.js` Tailwind v4 PostCSS 설정
