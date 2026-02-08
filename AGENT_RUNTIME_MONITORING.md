# Agent Runtime Monitoring

에이전트별 작업 흐름을 터미널에서 시각적으로 확인하기 위한 실행 가이드입니다.

## 1) 제공 방식

- `Inline 모드`: 단일 터미널에서 에이전트별 색상 prefix로 로그를 출력
- `Window 모드`: 에이전트별 새 PowerShell 창을 열어 분리 표시
- 공통: 실행 로그를 `.agent-logs/<timestamp>/`에 저장

## 2) 실행 스크립트

- 파일: `tools/Invoke-AgentMonitor.ps1`
- 검증: `tools/Verify-AgentEvidence.ps1` (Codex JSONL 증빙 검사)

기본 문법:

```powershell
.\tools\Invoke-AgentMonitor.ps1 -Plan quality -View inline
```

Codex 실제 실행 증빙 모드:

```powershell
.\tools\Invoke-AgentMonitor.ps1 -Plan intake -View inline -Runner codex
.\tools\Verify-AgentEvidence.ps1 -RequireCommandExecution
```

## 3) 기본 플랜

- `intake`: T0 성격의 요구사항/구조/오케스트레이션 체크
- `quality`: lint/type/syntax/dependency + 수동 검토 게이트
- `fullstack-smoke`: 컨테이너 기동 + health check 중심 스모크

예시:

```powershell
# 색상 태그 (단일 터미널)
.\tools\Invoke-AgentMonitor.ps1 -Plan intake -View inline

# 에이전트별 새 터미널 창
.\tools\Invoke-AgentMonitor.ps1 -Plan quality -View window

# Codex JSON 이벤트 기반 실행/증빙
.\tools\Invoke-AgentMonitor.ps1 -Plan quality -View inline -Runner codex
```

## 4) 커스텀 작업 정의

샘플 파일: `tools/agent-tasks.sample.json`

```powershell
.\tools\Invoke-AgentMonitor.ps1 -Plan custom -ConfigPath .\tools\agent-tasks.sample.json -View inline
.\tools\Invoke-AgentMonitor.ps1 -Plan custom -ConfigPath .\tools\agent-tasks.sample.json -View inline -Runner codex
```

JSON 형식:

```json
[
  {
    "agent": "code-tester",
    "workDir": ".",
    "command": "Set-Location frontend; npm run build",
    "prompt": "Act as code-tester. Run frontend build and summarize PASS/FAIL."
  }
]
```

필드 설명:

- `agent`: 에이전트 이름(색상/prefix 기준)
- `workDir`: 작업 디렉터리(상대/절대 경로)
- `command`: PowerShell 명령(`-Runner shell`)
- `prompt`: Codex 프롬프트(`-Runner codex`)

## 5) 안전 실행

- 먼저 `-DryRun`으로 계획 확인:

```powershell
.\tools\Invoke-AgentMonitor.ps1 -Plan quality -View inline -DryRun
```

- 긴 작업(`docker compose up -d --build`)은 필요 시에만 실행
- 실패한 에이전트는 summary에 `FAIL(code)`로 표시됨
- `-Runner codex` 사용 시 `.agent-logs/<timestamp>/`에 아래 파일이 생성됨:
  - `run-manifest.json`
  - `*.jsonl` (Codex `exec --json` 이벤트 로그)
  - `*.last.txt` (최종 응답)
  - `*.stream.log` (콘솔 스트림)
- `Verify-AgentEvidence.ps1`는 `DryRun` 결과 디렉터리를 입력하면 실패 처리합니다(실행 증빙 없음).
- 검증 명령:

```powershell
.\tools\Verify-AgentEvidence.ps1
.\tools\Verify-AgentEvidence.ps1 -RequireCommandExecution
```

## 6) 권장 운영 패턴

1. 작업 시작: `intake` 플랜으로 ScopeTag/DoD 확인
2. 구현 후: `quality` 플랜으로 병렬 검증
3. 배포 전: `fullstack-smoke` 또는 custom 플랜으로 스모크 검증
