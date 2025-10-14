#!/bin/bash

# witchs-cauldron 프로젝트 배포 스크립트
# 우분투 환경에서 실행

set -e

echo "🚀 Witchs Cauldron 프로젝트 배포를 시작합니다..."

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

# 기존 컨테이너 정리
cleanup_existing() {
    log_info "기존 컨테이너를 정리합니다..."
    
    # 실행 중인 컨테이너가 있다면 중지
    if docker ps -q --filter "name=witchs-cauldron-frontend" | grep -q .; then
        log_info "기존 컨테이너를 중지합니다..."
        docker stop witchs-cauldron-frontend-prod || true
    fi
    
    # 기존 컨테이너 제거
    if docker ps -aq --filter "name=witchs-cauldron-frontend" | grep -q .; then
        log_info "기존 컨테이너를 제거합니다..."
        docker rm witchs-cauldron-frontend-prod || true
    fi
}

# Docker 이미지 빌드
build_image() {
    log_info "Docker 이미지를 빌드합니다..."
    
    # 이전 이미지 제거 (옵션)
    if [ "$1" = "--clean" ]; then
        log_info "기존 이미지를 제거합니다..."
        docker rmi witchs-cauldron-frontend:latest || true
        # Docker 빌드 캐시도 정리
        docker builder prune -f || true
    fi
    
    # 이미지 빌드 (더 상세한 로그 출력)
    log_info "빌드 진행 상황을 모니터링합니다..."
    if docker compose version >/dev/null 2>&1; then
        docker compose --progress=plain -f docker-compose.prod.yml build --no-cache
    else
        docker-compose -f docker-compose.prod.yml build --no-cache --progress=plain || docker-compose -f docker-compose.prod.yml build --no-cache
    fi
    log_success "Docker 이미지 빌드가 완료되었습니다."
}

# 애플리케이션 실행
start_application() {
    log_info "애플리케이션을 시작합니다..."
    
    if docker compose version >/dev/null 2>&1; then
        docker compose -f docker-compose.prod.yml up -d
    else
        docker-compose -f docker-compose.prod.yml up -d
    fi
    
    log_success "애플리케이션이 시작되었습니다!"
    log_info "접속 URL: http://localhost:3000"
    log_info "상태 확인: docker compose -f docker-compose.prod.yml ps"
    log_info "로그 확인: docker compose -f docker-compose.prod.yml logs -f"
}

# 헬스체크
health_check() {
    log_info "애플리케이션 상태를 확인합니다..."
    
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            log_success "애플리케이션이 정상적으로 실행 중입니다! 🎉"
            return 0
        fi
        
        log_info "대기 중... ($attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    log_error "애플리케이션이 정상적으로 시작되지 않았습니다."
    log_info "로그를 확인하세요: docker compose -f docker-compose.prod.yml logs"
    return 1
}

# 메인 실행 로직
main() {
    log_info "=== Witchs Cauldron 배포 스크립트 ==="
    
    # 파라미터 확인
    CLEAN_BUILD=false
    if [ "$1" = "--clean" ]; then
        CLEAN_BUILD=true
        log_info "클린 빌드 모드로 실행합니다."
    fi
    
    # 실행 단계
    check_docker
    check_docker_compose
    cleanup_existing
    
    if [ "$CLEAN_BUILD" = true ]; then
        build_image --clean
    else
        build_image
    fi
    
    start_application
    health_check
    
    log_success "배포가 완료되었습니다! 🚀"
    echo ""
    echo "유용한 명령어:"
    echo "  상태 확인: docker compose -f docker-compose.prod.yml ps"
    echo "  로그 확인: docker compose -f docker-compose.prod.yml logs -f"
    echo "  중지: docker compose -f docker-compose.prod.yml down"
    echo "  재시작: docker compose -f docker-compose.prod.yml restart"
}

# 스크립트 실행
main "$@"