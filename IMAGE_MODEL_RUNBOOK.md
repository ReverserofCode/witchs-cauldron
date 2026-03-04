# IMAGE_MODEL_RUNBOOK

프로젝트에서 이미지가 필요한 작업 시 사용할 최소 실행 가이드입니다.

## 1) 현재 모델 상태 확인

```bash
openclaw models status
```

확인 포인트:
- Default: `openai-codex/gpt-5.3-codex` (텍스트 작업)
- Image model: `google/gemini-2.5-flash-image` (Nano Banana)
- Image fallbacks: Gemini 3.x image preview

## 2) 이미지 모델 별칭 확인

```bash
openclaw models aliases list
```

기대값:
- `nano-banana -> google/gemini-2.5-flash-image`

## 3) 운영 원칙

- 일반 개발/코드 작업: 기본 Codex 유지
- 이미지 생성/편집 필요 시: image model 체인 사용
- 실패 시 자동 fallback 허용(3.x preview)

## 4) 팀 운영 팁

- 이슈/PR에 이미지 산출물 목적(배너/썸네일/아이콘) 명시
- 파일명 규칙 예시:
  - `hero-banner-v1.png`
  - `youtube-thumb-2026-03-v2.png`
  - `feature-icon-analytics-v1.webp`
- 산출물 저장 경로 예시:
  - `frontend/public/mainPage/`
  - `frontend/public/assets/`

## 5) 빠른 점검 명령

```bash
openclaw models list
openclaw models image-fallbacks list
```

문제 시:
- Gemini 키 만료/권한 확인
- `openclaw status`로 세션/기본 모델 상태 재확인
