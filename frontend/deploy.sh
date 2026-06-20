#!/bin/bash

# witchs-cauldron 프로젝트 배포 스크립트
# 현재 전략은 완전한 무중단이 아니라 재기동 기반 교체 배포에 가깝습니다.
# 우분투 환경에서 실행

set -e

# 배포 대상 compose 파일/헬스체크 URL (필요 시 환경변수로 오버라이드)
COMPOSE_FILE="${DEPLOY_COMPOSE_FILE:-docker-compose.server.yml}"
if [ ! -f "$COMPOSE_FILE" ]; then
    if [ "$COMPOSE_FILE" = "docker-compose.server.yml" ] && [ -f "docker-compose.prod.yml" ]; then
        COMPOSE_FILE="docker-compose.prod.yml"
    else
        echo "[ERROR] compose 파일을 찾을 수 없습니다: $COMPOSE_FILE"
        exit 1
    fi
fi

HEALTHCHECK_URL="${DEPLOY_HEALTHCHECK_URL:-http://localhost:3000}"
if [ "$COMPOSE_FILE" = "docker-compose.server.yml" ] && [ -z "${DEPLOY_HEALTHCHECK_URL:-}" ]; then
    HEALTHCHECK_URL="http://127.0.0.1:13000"
fi

echo "🚀 Witchs Cauldron 프로젝트 배포를 시작합니다..."
echo "📦 Compose: $COMPOSE_FILE"
echo "🩺 Health URL: $HEALTHCHECK_URL"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "필수 명령을 찾을 수 없습니다: $1"
        exit 1
    fi
}

compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

preflight_checks() {
    log_info "배포 전 사전 점검을 수행합니다..."
    require_command curl
    require_command docker

    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "compose 파일이 없습니다: $COMPOSE_FILE"
        exit 1
    fi

    if [ "$COMPOSE_FILE" = "docker-compose.server.yml" ] && ! docker network inspect web >/dev/null 2>&1; then
        log_error "외부 Docker 네트워크 'web' 이 없습니다. 먼저 생성해야 합니다."
        exit 1
    fi
}

# Docker 설치 확인
check_docker() {
    log_info "Docker 설치 상태를 확인합니다..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되어 있지 않습니다."
        log_info "Docker 설치를 진행합니다..."

        # Docker 설치
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER

        log_warning "Docker 그룹에 사용자를 추가했습니다. 로그아웃 후 다시 로그인하거나 'newgrp docker' 명령을 실행하세요."
    else
        log_success "Docker가 이미 설치되어 있습니다."
        docker --version
    fi
}

# Docker Compose 설치 확인
check_docker_compose() {
    log_info "Docker Compose 플러그인(docker compose) 사용 가능 여부를 확인합니다..."
    if docker compose version >/dev/null 2>&1; then
        log_success "Docker Compose 플러그인 사용 가능: $(docker compose version --short 2>/dev/null || true)"
        return 0;
    fi
    # 구형 standalone docker-compose 확인
    if command -v docker-compose &>/dev/null; then
        log_warning "standalone docker-compose 감지됨. 가능하면 Docker 최신 버전(플러그인 형태) 사용을 권장합니다."
        docker-compose --version
        return 0
    fi
    log_error "Docker Compose가 설치되어 있지 않습니다. 설치를 진행합니다."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
}

# Docker 이미지 빌드 (기존 컨테이너 유지)
build_image() {
    log_info "Docker 이미지를 빌드합니다 (기존 서비스 유지)..."

    # 빌드 플래그 초기화
    BUILD_FLAGS=""

    # 클린 빌드 옵션
    if [ "$1" = "--clean" ]; then
        log_info "빌드 캐시를 정리합니다..."
        docker builder prune -f || true
        BUILD_FLAGS="--no-cache"
        log_info "캐시 없이 빌드를 진행합니다..."
    fi

    # 이미지 빌드 (기존 컨테이너는 계속 실행 중)
    log_info "빌드 진행 상황을 모니터링합니다..."
    if docker compose version >/dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" build $BUILD_FLAGS
    else
        docker-compose -f "$COMPOSE_FILE" build $BUILD_FLAGS
    fi
    log_success "Docker 이미지 빌드가 완료되었습니다."
}

# 잔여 컨테이너 강제 정리
cleanup_stale_containers() {
    log_info "잔여 컨테이너를 정리합니다..."
    for name in witchs-cauldron-frontend-prod witchs-cauldron-backend-prod witchs-cauldron-analytics-db-prod; do
        if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
            log_info "잔여 컨테이너 제거: ${name}"
            docker rm -f "$name" 2>/dev/null || true
        fi
    done
}

# 애플리케이션 교체 (무중단)
replace_application() {
    log_info "애플리케이션을 교체합니다 (무중단 배포)..."

    if docker compose version >/dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
        cleanup_stale_containers
        docker compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans
    else
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
        cleanup_stale_containers
        docker-compose -f "$COMPOSE_FILE" up -d --force-recreate --remove-orphans
    fi

    log_success "애플리케이션이 교체되었습니다!"
}

# 헬스체크
health_check() {
    log_info "애플리케이션 상태를 확인합니다..."

    max_attempts=30
    attempt=1

    check_backend_health() {
        if [ -n "${DEPLOY_BACKEND_HEALTHCHECK_URL:-}" ]; then
            curl -fsS "$DEPLOY_BACKEND_HEALTHCHECK_URL" > /dev/null 2>&1
            return $?
        fi

        compose_cmd -f "$COMPOSE_FILE" exec -T backend \
            curl -fsS http://localhost:8000/api/health > /dev/null 2>&1
    }

    while [ $attempt -le $max_attempts ]; do
        frontend_ok=false
        backend_ok=false

        if curl -fsS "$HEALTHCHECK_URL" > /dev/null 2>&1; then
            frontend_ok=true
        fi

        if check_backend_health; then
            backend_ok=true
        fi

        if [ "$frontend_ok" = true ] && [ "$backend_ok" = true ]; then
            log_success "프론트엔드/백엔드가 정상적으로 실행 중입니다! 🎉"
            return 0
        fi

        log_info "대기 중... ($attempt/$max_attempts) frontend=$frontend_ok backend=$backend_ok"
        sleep 2
        ((attempt++))
    done

    log_error "애플리케이션이 정상적으로 시작되지 않았습니다."
    log_info "로그를 확인하세요: docker compose -f $COMPOSE_FILE logs"
    return 1
}

# 이전 이미지 정리 (선택적)
cleanup_old_images() {
    log_info "사용하지 않는 이미지를 정리합니다..."
    docker image prune -f || true
}

# 롤백 함수 (배포 실패 시)
rollback() {
    log_error "배포 실패! 롤백을 시도합니다..."

    # 이전 이미지가 있다면 롤백
    if docker compose version >/dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" down
        docker compose -f "$COMPOSE_FILE" up -d
    else
        docker-compose -f "$COMPOSE_FILE" down
        docker-compose -f "$COMPOSE_FILE" up -d
    fi

    log_warning "롤백이 완료되었습니다. 수동으로 상태를 확인하세요."
}

# 메인 실행 로직
main() {
    log_info "=== Witchs Cauldron 무중단 배포 스크립트 ==="

    # 파라미터 확인
    CLEAN_BUILD=false
    if [ "$1" = "--clean" ]; then
        CLEAN_BUILD=true
        log_info "클린 빌드 모드로 실행합니다."
    fi

    # 실행 단계
    check_docker
    check_docker_compose
    preflight_checks

    # 1. 새 이미지 빌드 (기존 컨테이너 유지)
    if [ "$CLEAN_BUILD" = true ]; then
        build_image --clean
    else
        build_image
    fi

    # 2. 컨테이너 교체 (무중단)
    replace_application

    # 3. 헬스체크
    if ! health_check; then
        rollback
        exit 1
    fi

    # 4. 정리
    cleanup_old_images

    log_success "무중단 배포가 완료되었습니다! 🚀"
    echo ""
    echo "유용한 명령어:"
    echo "  상태 확인: docker compose -f $COMPOSE_FILE ps"
    echo "  로그 확인: docker compose -f $COMPOSE_FILE logs -f"
    echo "  중지: docker compose -f $COMPOSE_FILE down"
    echo "  재시작: docker compose -f $COMPOSE_FILE restart"
}

# 스크립트 실행
main "$@"
