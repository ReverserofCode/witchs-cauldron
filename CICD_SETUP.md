# CI/CD 구축 가이드

## 개요

GitHub Actions를 사용하여 Witchs Cauldron 프로젝트의 CI/CD 파이프라인을 구축합니다.
- **CI**: Pull Request 시 코드 품질 검증 (타입체크, 린트, 빌드)
- **CD**: main 브랜치 푸시 시 Self-hosted Ubuntu 서버에 자동 배포

## 현재 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| `.github/workflows/ci.yml` | ✅ 완료 | PR 검증 워크플로우 |
| `.github/workflows/cd.yml` | ✅ 완료 | 자동 배포 워크플로우 (비밀번호 인증) |
| GitHub Secrets | ⏳ 대기 | 수동 설정 필요 |

## 파이프라인 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │   CI Workflow   │     │   CD Workflow   │                   │
│  │  (Pull Request) │     │  (main branch)  │                   │
│  ├─────────────────┤     ├─────────────────┤                   │
│  │ 1. Checkout     │     │ 1. Checkout     │                   │
│  │ 2. Setup Node   │     │ 2. Setup Node   │                   │
│  │ 3. Install deps │     │ 3. Install deps │                   │
│  │ 4. Type Check   │     │ 4. Type Check   │                   │
│  │ 5. Lint         │     │ 5. Lint         │                   │
│  │ 6. Build        │     │ 6. Build        │                   │
│  └─────────────────┘     │ 7. SSH Deploy   │                   │
│                          └────────┬────────┘                   │
│                                   │                             │
└───────────────────────────────────┼─────────────────────────────┘
                                    │ SSH
                                    ▼
                    ┌───────────────────────────────┐
                    │     Ubuntu Server             │
                    ├───────────────────────────────┤
                    │ 1. git pull                   │
                    │ 2. ./deploy.sh (Docker build) │
                    │ 3. Health check               │
                    └───────────────────────────────┘
```

## GitHub Secrets 설정

### 필요한 Secrets

| Secret 이름 | 설명 | 값 |
|-------------|------|-----|
| `SSH_HOST` | 서버 IP | `1.201.17.238` |
| `SSH_USERNAME` | SSH 사용자명 | `root` |
| `SSH_PASSWORD` | SSH 비밀번호 | (GitHub Secrets에 직접 입력) |
| `SSH_PORT` | SSH 포트 | `22` |
| `DEPLOY_PATH` | 서버 내 프로젝트 경로 | `~/projects/witchs-cauldron` |

### 설정 방법

1. GitHub 리포지토리 접속
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** 클릭
4. 각 Secret 이름과 값 입력 후 저장

### 설정할 값 요약

```
SSH_HOST       = 1.201.17.238
SSH_USERNAME   = root
SSH_PASSWORD   = (비밀번호 직접 입력)
SSH_PORT       = 22
DEPLOY_PATH    = ~/projects/witchs-cauldron
```

## 서버 준비 사항

### 서버 정보

- **Host**: `1.201.17.238`
- **User**: `root`
- **Project Path**: `~/projects/witchs-cauldron`

### 서버 환경 확인

```bash
# 서버 접속
ssh root@1.201.17.238

# Docker 설치 확인
docker --version
docker-compose --version

# Git 설치 확인
git --version

# 프로젝트 디렉토리 확인
ls -la ~/projects/witchs-cauldron

# .env 파일 존재 확인
cat ~/projects/witchs-cauldron/.env

# deploy.sh 실행 권한 확인
ls -la ~/projects/witchs-cauldron/deploy.sh
# 권한 없으면: chmod +x deploy.sh
```

### 서버 체크리스트

- [ ] Docker 및 Docker Compose 설치됨
- [ ] Git 설치됨
- [ ] 프로젝트 디렉토리에 .env 파일 존재 (YOUTUBE_API_KEY 등)
- [ ] deploy.sh 실행 권한 있음 (`chmod +x deploy.sh`)

## 검증 방법

### 1. CI 워크플로우 테스트

```bash
# 새 브랜치 생성 후 PR 올리기
git checkout -b test/ci-workflow
echo "# test" >> test.md
git add . && git commit -m "test: CI workflow trigger"
git push origin test/ci-workflow

# GitHub에서 PR 생성 → Actions 탭에서 CI 실행 확인
# 테스트 후 브랜치 삭제
git checkout main
git branch -D test/ci-workflow
git push origin --delete test/ci-workflow
```

### 2. CD 워크플로우 테스트

```bash
# main 브랜치에 직접 푸시 (또는 PR 머지)
git checkout main
git merge test/ci-workflow
git push origin main

# Actions 탭에서 CD 실행 확인
```

### 3. 서버 상태 확인

```bash
# SSH로 서버 접속
ssh root@1.201.17.238

# 배포 상태 확인
cd ~/projects/witchs-cauldron
./manage.sh status
./manage.sh health

# 로그 확인
./manage.sh logs-tail
```

## 워크플로우 파일 위치

```
.github/
└── workflows/
    ├── ci.yml          # CI 워크플로우 (PR 검증)
    └── cd.yml          # CD 워크플로우 (자동 배포)
```

## 트러블슈팅

### CI 실패 시

1. **TypeScript 에러**: `npx tsc --noEmit` 로컬에서 실행하여 에러 확인
2. **Lint 에러**: `npm run lint` 로컬에서 실행하여 에러 확인
3. **Build 에러**: `npm run build` 로컬에서 실행하여 에러 확인

### CD 실패 시

1. **SSH 연결 실패**: Secrets 값 확인 (SSH_HOST, SSH_USERNAME, SSH_PASSWORD, SSH_PORT)
2. **git pull 실패**: 서버에서 git 인증 상태 확인
3. **deploy.sh 실패**: 서버에서 직접 `./deploy.sh` 실행하여 에러 확인

### SSH 연결 테스트

```bash
# 로컬에서 SSH 연결 테스트
ssh root@1.201.17.238

# 서버에서 프로젝트 디렉토리 확인
cd ~/projects/witchs-cauldron
git status
```

## 보안 권장사항

현재 비밀번호 기반 SSH 인증을 사용하고 있습니다. 보안 강화를 위해 다음을 고려하세요:

1. **SSH 키 기반 인증으로 전환**: 비밀번호보다 안전함
2. **비밀번호 정기 변경**: 보안을 위해 주기적으로 변경
3. **SSH 포트 변경**: 기본 22번 포트 대신 다른 포트 사용
4. **Fail2ban 설치**: 무차별 대입 공격 방지

## 향후 개선 사항 (선택)

1. **Docker 이미지 캐싱**: GitHub Container Registry에 이미지 푸시 후 서버에서 pull
2. **Slack/Discord 알림**: 배포 성공/실패 알림
3. **롤백 자동화**: 배포 실패 시 이전 버전으로 자동 롤백
4. **스테이징 환경**: develop 브랜치용 스테이징 서버 추가
5. **E2E 테스트**: Playwright/Cypress 통합

## 작업 체크리스트

- [x] `.github/workflows/ci.yml` 생성
- [x] `.github/workflows/cd.yml` 생성
- [ ] GitHub Repository Secrets 설정
  - [ ] SSH_HOST = `1.201.17.238`
  - [ ] SSH_USERNAME = `root`
  - [ ] SSH_PASSWORD = (비밀번호)
  - [ ] SSH_PORT = `22`
  - [ ] DEPLOY_PATH = `~/projects/witchs-cauldron`
- [ ] 서버 환경 확인 (Docker, Git, deploy.sh 권한)
- [ ] 테스트 PR로 CI 검증
- [ ] main 푸시로 CD 검증
