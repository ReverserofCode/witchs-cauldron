# Agent Teams for Codex

이 문서는 작업 시작 전에 일관된 멀티 에이전트 워크플로우를 적용하기 위한 팀 운영 기준입니다.

## 1) Team 구성

| Team | 목적 | 리드/핵심 에이전트 | 병렬 여부 |
|---|---|---|---|
| `T0-Intake` | 요구사항 정리, 범위 확정, 영향도 파악 | `requirements-analyzer`, `codebase-structure-analyzer`, `orchestrator-planner` | 부분 병렬 |
| `T1-Implement` | 코드 구현/수정, 외부 연동 반영 | `code-generator`, `external-tool-integrator` | 순차 우선 |
| `T2-Quality` | 품질 게이트 (정적/동적 검증) | `lint-checker`, `code-validator`, `code-tester`, `dependency-analyzer` | 병렬 권장 |
| `T3-ReleaseDocs` | 변경 요약, 운영 문서 반영 | `documentation-generator`, `orchestrator-planner` | 순차 |

## 1-1) Agent 점검 결과 (2026-02-08)

| 점검 항목 | 결과 | 보완 조치 |
|---|---|---|
| `.claude/agents` 실제 파일 수 | 11개 확인 | 기준 목록 유지 |
| Team 워크플로우와 오케스트레이터 정합성 | `orchestrator-planner`의 Available Agents/Workflow가 일부 누락 | `.claude/agents/orchestrator-planner.md` 동기화 완료 (`lint-checker`, `documentation-generator` 포함) |
| `token-optimizer` 배치 | 본문 단계에 명시 흐름 부재 | `T-Prep`(선행 최적화) 단계 추가 |
| 도메인 커버리지 | 다수 에이전트 프롬프트가 Frontend/Next.js 중심 | Backend/FastAPI/Analytics 작업 시 T0에서 범위 태그(`frontend`/`backend`/`fullstack`)를 명시하도록 운영 규칙 추가 |
| 시각적 가시성 | 팀/에이전트 흐름을 한 화면에서 보는 문서 부재 | `AGENT_WORKFLOW_VISUAL.md` 추가 (Mermaid 기반) |

## 2) 기본 실행 순서

0. (선택) `T-Prep`에서 `token-optimizer`로 대규모 컨텍스트 정리
1. `T0-Intake`에서 작업 목표와 완료 기준(DoD) 고정
2. `T1-Implement`에서 최소 변경으로 구현
3. `T2-Quality`를 병렬 실행해 실패 항목 즉시 피드백
4. `T3-ReleaseDocs`에서 문서/릴리즈 노트 정리

## 3) 작업 유형별 플레이북

### A. 기능 추가
1. `requirements-analyzer` -> API/UX/데이터 요구사항 명세화
2. `codebase-structure-analyzer` -> 영향 파일 식별
3. `code-generator` -> 구현
4. `lint-checker` + `code-tester` + `code-validator` 병렬 검증
5. `documentation-generator` -> README/CLAUDE/운영문서 반영

### B. 버그 수정
1. `codebase-structure-analyzer` -> 원인 후보 축소
2. `code-generator` -> 재현 가능한 최소 수정
3. `code-tester` + `code-validator` 병렬 검증
4. `documentation-generator` -> 재발 방지 메모 반영

### C. 배포 전 점검
1. `dependency-analyzer` -> 취약점/불필요 의존성 확인
2. `lint-checker` + `code-tester` 병렬 실행
3. `orchestrator-planner` -> 잔여 리스크 정리
4. `documentation-generator` -> 배포 체크리스트 업데이트

### D. 대규모 변경/장문 컨텍스트
1. `token-optimizer` -> 입력 컨텍스트 압축/중복 제거
2. `orchestrator-planner` -> 단계 계획 및 병렬화 설계
3. `T0 -> T3` 표준 흐름 실행

## 4) 병렬 실행 규칙

- 병렬로 묶기 좋은 조합:
  - `lint-checker` + `code-tester`
  - `code-validator` + `dependency-analyzer`
- 병렬로 묶지 말 것:
  - 동일 파일을 동시에 수정하는 구현 단계
  - 외부 상태(환경변수, Docker 컨테이너)를 동시 변경하는 단계

## 5) Handoff 템플릿

각 Team이 다음 Team에 넘길 때 아래 5개를 고정 전달합니다.

```text
[Goal] 이번 단계 목표
[Scope] 변경 파일/시스템 범위
[Done] 완료 조건(정량)
[Risk] 남은 리스크
[Evidence] 실행 로그/검증 결과
```

## 6) Definition of Done (DoD)

- 기능 요구사항이 명확히 충족됨
- `tsc/lint/build` 또는 Docker 스모크 테스트 통과
- 문서(최소 1개 이상) 업데이트 완료
- 롤백/우회 방법이 기록됨 (운영 영향 변경 시)

## 7) 운영 팁

- 대규모 변경은 항상 `orchestrator-planner`를 선행하여 단계를 쪼갭니다.
- 구현 품질보다 우선하는 것은 재현 가능한 검증 로그입니다.
- 에이전트 수를 늘리기보다, `T0 -> T2` 피드백 루프를 짧게 유지하는 것이 효율적입니다.
- Backend/FastAPI/Postgres 변경이 포함되면 T0 산출물에 `ScopeTag: backend` 또는 `ScopeTag: fullstack`를 반드시 기록합니다.
- `ScopeTag`가 `backend`/`fullstack`인 경우 T2 Evidence에 Backend health/API 스모크 로그를 포함합니다.

## 8) CLI 자동 주입 규칙

- PowerShell 래퍼로 `codex`, `claude` 실행 시 아래 문서가 자동 컨텍스트로 주입됩니다.
- `AGENT_TEAMS.md`
- `CLAUDE.md`
- `CLI_DOCKER_TESTING.md`
- 동작 예외:
- `codex --help`, `codex --version`
- `codex exec ...`, `codex review ...` 같은 서브커맨드
- `claude --help`, `claude --version`

## 9) 시각화 문서

- 팀 워크플로우/에이전트 매핑/품질 게이트를 시각적으로 확인하려면 `AGENT_WORKFLOW_VISUAL.md`를 사용합니다.
- GitHub 또는 Mermaid 지원 Markdown Preview에서 즉시 렌더링 가능합니다.

## 10) 런타임 모니터링

- 에이전트별 실제 실행 로그를 시각적으로 확인하려면 `AGENT_RUNTIME_MONITORING.md`를 사용합니다.
- 실행 스크립트: `tools/Invoke-AgentMonitor.ps1`
- 모드:
  - `-View inline`: 단일 터미널 색상 태그 출력
  - `-View window`: 에이전트별 새 PowerShell 창 분리
