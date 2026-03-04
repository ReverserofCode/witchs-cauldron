# CODEX + CLAUDE CODE 운용 전략 (Witchs Cauldron)

본 문서는 코딩 작업 시 Codex와 Claude Code를 **항상 병행**하기 위한 표준 운영 전략이다.

## 1) 기본 원칙

1. 단독 구현 금지
   - 구현은 한 모델이 주도하더라도, 다른 모델의 리뷰를 필수로 받는다.
2. 최소 리스크 우선
   - 같은 결과라면 파일 변경 수가 적고 회귀 가능성이 낮은 방법을 채택한다.
3. 증거 기반 검증
   - 빌드/린트/헬스체크 없이 “완료” 판정하지 않는다.
4. 에이전트 결합
   - `.claude/agents`의 도메인 에이전트를 task별로 필수 결합한다.

---

## 2) 역할 분담

### Claude Code (분석/설계/리스크)
- 요구사항 해석, 문제 경계 정의
- 아키텍처/UX/접근성/운영 리스크 평가
- 변경 영향 범위와 회귀 포인트 식별

### Codex (구현/정밀 패치/검증 관점)
- 최소 diff 중심 패치 제안 및 구현
- 타입/임포트/로직 정합성 정밀 점검
- 테스트/실행 명령 기반 빠른 확인

---

## 3) 표준 워크플로우

1. **Route (분류)**
   - 작업 유형 결정 (버그/리팩터/레이아웃/API/CI 등)
   - 관련 에이전트 1~2개 선택
2. **Analyze (이중 분석)**
   - Claude: 원인/영향/리스크
   - Codex: 최소 패치안/충돌 포인트
3. **Plan Merge (합의안 확정)**
   - 공통분모를 채택하고 충돌안은 옵션 비교 후 결정
4. **Implement (구현)**
   - 주도 모델 1개로 코드 반영
   - 보조 모델이 diff 리뷰
5. **Verify (게이트 검증)**
   - `npm run build`
   - `./scripts/run-local.sh status` 또는 health check
   - 필요 시 CI 실행/확인
6. **Ship (커밋/푸시/배포 확인)**
   - 원인/수정/검증/리스크 4줄 요약과 함께 보고

---

## 4) 작업 유형별 매트릭스

| 작업 유형 | Primary | Secondary | 필수 에이전트 | 완료 기준 |
|---|---|---|---|---|
| 로컬 버그 수정(단일 영역) | Codex | Claude | `requirements-analyzer`, `lint-checker` | 재현 증상 해소 + build 성공 |
| UI/레이아웃 개선 | Claude | Codex | `codebase-structure-analyzer`, `code-validator` | 디자인 컨셉/팔레트 유지 + 회귀 없음 |
| API 계약/데이터 불일치 | Claude | Codex | `api-contract-checker` | FE/BE 응답 shape 일치 |
| CI/CD 수정 | Claude | Codex | `workflow-guardian` | CI green + 배포 안전성 확인 |
| 릴리즈 요약/문서 | Claude | Codex | `release-note-writer`, `documentation-generator` | 사용자/운영자 가독성 기준 충족 |
| 장애 핫픽스 | Codex | Claude | `smoke-test-runner` | 증상 해소 + 롤백 가능성 확보 |

---

## 5) 충돌 해결 규칙

- 사실 충돌(정확성/API): 코드/공식 문서 확인 후 사실 우선
- 구조 충돌(추상화 vs 단순화): 변경 파일 수/리스크가 낮은 안 우선
- 성능 vs 안정성 충돌: 기본은 안정성 우선
- 미해결 시: 사용자에게 A/B 옵션+영향 1문장씩 제시 후 결정

---

## 6) 검증 게이트 (필수)

- Build: `frontend` 기준 `npm run build`
- Runtime: `http://127.0.0.1:3000/api/health`, `http://127.0.0.1:8000/api/health`
- 배포: GitHub Actions CD 성공 확인

---

## 7) 운영 메모

- 장시간 모니터링/배포 확인 요청은 결과 메시지 1회만 전송
- WSL+Windows 혼합 환경 특성상 동기화 이슈를 우선 점검
- `rightAside` 같은 가변 콘텐츠 영역은 항상 높이/스크롤 정책을 함께 검토
