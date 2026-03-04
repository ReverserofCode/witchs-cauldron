# Agent 활용 방안 (실행 기준)

## 목적
프로젝트 내 기존 `.claude/agents`를 작업 유형에 맞게 체계적으로 호출하여 품질과 속도를 동시에 확보한다.

## 기본 호출 순서
1) `requirements-analyzer`로 요구사항/완료기준 확정
2) 작업 유형별 전용 에이전트 호출
3) `orchestrator-planner`로 단계/우선순위 재정렬
4) 구현 후 `lint-checker` + `smoke-test-runner` 검증

---

## 시나리오별 에이전트 조합

### A. UI/UX 개선 (컨셉 유지형)
- 필수: `requirements-analyzer` → `codebase-structure-analyzer` → `code-validator`
- 보조: `documentation-generator`
- 산출물: 변경 파일 목록, before/after 체크리스트

### B. API 계약 이슈
- 필수: `api-contract-checker`
- 보조: `code-tester`, `smoke-test-runner`
- 산출물: 불일치 항목, 호환성 우선 패치안

### C. CI/CD 변경
- 필수: `workflow-guardian`
- 보조: `release-note-writer`
- 산출물: 트리거/시크릿/배포 영향 요약 + 안전 테스트 절차

### D. 성능/의존성 정리
- 필수: `dependency-analyzer`
- 보조: `token-optimizer`, `lint-checker`
- 산출물: 의존성 영향표, 제거/업그레이드 계획

### E. 이미지 작업
- 필수: `image-asset-generator`
- 보조: `documentation-generator`
- 산출물: 프롬프트/파일명 규칙/배치 경로

---

## Done 정의 (Agent 공통)
- 분석/계획: 문제/원인/수정/검증 항목이 문서화됨
- 구현: 최소 변경 원칙 준수
- 검증: build + health check 성공
- 배포: CI/CD success 확인

---

## 운영 규칙
- 작업 시작 전: Codex + Claude 동시 분석
- 구현 단계: Primary 1개, Secondary 리뷰 1개 고정
- 사용자 보고: "원인 → 수정 → 검증 → 리스크" 4줄 요약
