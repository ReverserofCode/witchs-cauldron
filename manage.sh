#!/bin/bash

# witchs-cauldron 관리 스크립트
# 애플리케이션 관리를 위한 유틸리티 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

COMPOSE_FILE="docker-compose.prod.yml"

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

# 도움말 표시
show_help() {
    echo "Witchs Cauldron 관리 스크립트"
    echo ""
    echo "사용법: $0 [명령어]"
    echo ""
    echo "명령어:"
    echo "  start     - 애플리케이션 시작"
    echo "  stop      - 애플리케이션 중지"
    echo "  restart   - 애플리케이션 재시작"
    echo "  status    - 애플리케이션 상태 확인"
    echo "  logs      - 로그 확인 (실시간)"
    echo "  logs-tail - 최근 로그 확인"
    echo "  build     - 이미지 다시 빌드"
    echo "  clean     - 모든 컨테이너와 이미지 정리"
    echo "  update    - 애플리케이션 업데이트 (빌드 + 재시작)"
    echo "  health    - 헬스체크 수행"
    echo "  shell     - 컨테이너 내부 쉘 접근"
    echo "  help      - 이 도움말 표시"
    echo ""
    echo "예시:"
    echo "  $0 start"
    echo "  $0 logs"
    echo "  $0 update"
}

# 애플리케이션 시작
start_app() {
    log_info "애플리케이션을 시작합니다..."
    docker-compose -f $COMPOSE_FILE up -d
    log_success "애플리케이션이 시작되었습니다."
    log_info "접속 URL: http://localhost:3000"
}

# 애플리케이션 중지
stop_app() {
    log_info "애플리케이션을 중지합니다..."
    docker-compose -f $COMPOSE_FILE down
    log_success "애플리케이션이 중지되었습니다."
}

# 애플리케이션 재시작
restart_app() {
    log_info "애플리케이션을 재시작합니다..."
    docker-compose -f $COMPOSE_FILE restart
    log_success "애플리케이션이 재시작되었습니다."
}

# 상태 확인
check_status() {
    log_info "애플리케이션 상태를 확인합니다..."
    docker-compose -f $COMPOSE_FILE ps
    echo ""
    
    # 헬스체크 상태도 확인
    container_id=$(docker-compose -f $COMPOSE_FILE ps -q frontend)
    if [ ! -z "$container_id" ]; then
        health_status=$(docker inspect --format='{{.State.Health.Status}}' $container_id 2>/dev/null || echo "unknown")
        log_info "헬스 상태: $health_status"
    fi
}

# 로그 확인
show_logs() {
    if [ "$1" = "tail" ]; then
        log_info "최근 로그를 표시합니다..."
        docker-compose -f $COMPOSE_FILE logs --tail=100
    else
        log_info "실시간 로그를 표시합니다... (Ctrl+C로 종료)"
        docker-compose -f $COMPOSE_FILE logs -f
    fi
}

# 이미지 빌드
build_image() {
    log_info "Docker 이미지를 다시 빌드합니다..."
    log_info "빌드 캐시를 정리합니다..."
    docker builder prune -f || true
    docker-compose -f $COMPOSE_FILE build --no-cache --progress=plain
    log_success "이미지 빌드가 완료되었습니다."
}

# 정리
clean_all() {
    log_warning "모든 컨테이너와 이미지를 정리합니다..."
    read -p "정말로 계속하시겠습니까? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "정리를 시작합니다..."
        
        # 컨테이너 중지 및 제거
        docker-compose -f $COMPOSE_FILE down --rmi all --volumes --remove-orphans
        
        # 사용하지 않는 이미지 정리
        docker image prune -f
        
        log_success "정리가 완료되었습니다."
    else
        log_info "정리가 취소되었습니다."
    fi
}

# 업데이트
update_app() {
    log_info "애플리케이션을 업데이트합니다..."
    
    # 빌드
    build_image
    
    # 재시작
    log_info "애플리케이션을 재시작합니다..."
    docker-compose -f $COMPOSE_FILE up -d --force-recreate
    
    log_success "업데이트가 완료되었습니다."
}

# 헬스체크
health_check() {
    log_info "헬스체크를 수행합니다..."
    
    max_attempts=10
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            log_success "애플리케이션이 정상 작동 중입니다! ✅"
            return 0
        fi
        
        log_info "대기 중... ($attempt/$max_attempts)"
        sleep 3
        ((attempt++))
    done
    
    log_error "애플리케이션이 응답하지 않습니다. ❌"
    return 1
}

# 컨테이너 쉘 접근
access_shell() {
    container_id=$(docker-compose -f $COMPOSE_FILE ps -q frontend)
    
    if [ -z "$container_id" ]; then
        log_error "실행 중인 컨테이너를 찾을 수 없습니다."
        return 1
    fi
    
    log_info "컨테이너 쉘에 접근합니다..."
    docker exec -it $container_id /bin/sh
}

# 메인 로직
case "$1" in
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    restart)
        restart_app
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    logs-tail)
        show_logs tail
        ;;
    build)
        build_image
        ;;
    clean)
        clean_all
        ;;
    update)
        update_app
        ;;
    health)
        health_check
        ;;
    shell)
        access_shell
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "알 수 없는 명령어입니다: $1"
        echo ""
        show_help
        exit 1
        ;;
esac