# Witchs Cauldron - Ubuntu 배포 가이드

이 가이드는 Witchs Cauldron Next.js 애플리케이션을 Ubuntu 환경에서 Docker를 사용하여 배포하는 방법을 설명합니다.

## 📋 사전 요구사항

- Ubuntu 18.04 이상
- 최소 2GB RAM
- 최소 10GB 디스크 공간
- 인터넷 연결

## 🚀 빠른 시작

### 1단계: 프로젝트 복사

```bash
# 프로젝트 파일들을 Ubuntu 서버로 복사
scp -r /path/to/frontend ubuntu-user@your-server:/home/ubuntu/witchs-cauldron

# 또는 Git을 사용하는 경우
git clone <repository-url> /home/ubuntu/witchs-cauldron
cd /home/ubuntu/witchs-cauldron
```

### 2단계: 배포 스크립트 실행

```bash
# 스크립트 실행 권한 부여
chmod +x deploy.sh manage.sh

# 자동 배포 실행
./deploy.sh

# 클린 빌드로 배포 (캐시 없이)
./deploy.sh --clean
```

배포 스크립트는 다음을 자동으로 수행합니다:

- Docker 및 Docker Compose 설치 확인
- 필요한 패키지 설치
- Docker 이미지 빌드
- 애플리케이션 시작
- 헬스체크 수행

### 3단계: 애플리케이션 확인

```bash
# 상태 확인
./manage.sh status

# 웹 브라우저에서 접속
# http://your-server-ip:3000
```

## 🛠️ 수동 설치

자동 설치가 작동하지 않는 경우 수동으로 설치할 수 있습니다.

### Docker 설치

```bash
# 시스템 업데이트
sudo apt update
sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 로그아웃 후 재로그인 또는
newgrp docker
```

### Docker Compose 설치

```bash
# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 설치 확인
docker-compose --version
```

### 애플리케이션 빌드 및 실행

```bash
# 프로젝트 디렉토리로 이동
cd /path/to/witchs-cauldron

# Docker 이미지 빌드
docker-compose -f docker-compose.prod.yml build

# 애플리케이션 시작
docker-compose -f docker-compose.prod.yml up -d

# 상태 확인
docker-compose -f docker-compose.prod.yml ps
```

## 📱 관리 스크립트 사용법

`manage.sh` 스크립트를 사용하여 애플리케이션을 쉽게 관리할 수 있습니다.

```bash
# 애플리케이션 시작
./manage.sh start

# 애플리케이션 중지
./manage.sh stop

# 애플리케이션 재시작
./manage.sh restart

# 상태 확인
./manage.sh status

# 실시간 로그 확인
./manage.sh logs

# 최근 로그 확인
./manage.sh logs-tail

# 이미지 다시 빌드
./manage.sh build

# 애플리케이션 업데이트 (빌드 + 재시작)
./manage.sh update

# 헬스체크
./manage.sh health

# 컨테이너 쉘 접근
./manage.sh shell

# 모든 것 정리 (주의!)
./manage.sh clean
```

## 🔧 설정

### 환경 변수

필요에 따라 환경 변수를 설정할 수 있습니다. `docker-compose.prod.yml` 파일을 편집하세요:

```yaml
environment:
  - NODE_ENV=production
  - NEXT_TELEMETRY_DISABLED=1
  - PORT=3000
  - HOSTNAME=0.0.0.0
  # 추가 환경 변수들...
```

### 포트 변경

기본 포트(3000)를 변경하려면 `docker-compose.prod.yml`에서 포트 매핑을 수정하세요:

```yaml
ports:
  - "8080:3000" # 외부 포트:내부 포트
```

## 🔍 문제 해결

### 일반적인 문제들

1. **포트가 이미 사용 중인 경우**

   ```bash
   # 포트 사용 중인 프로세스 확인
   sudo netstat -tlnp | grep :3000

   # 프로세스 종료
   sudo kill -9 <PID>
   ```

2. **Docker 권한 문제**

   ```bash
   # 현재 사용자를 docker 그룹에 추가
   sudo usermod -aG docker $USER
   newgrp docker
   ```

3. **메모리 부족**

   ```bash
   # 시스템 리소스 확인
   free -h
   df -h

   # Docker 시스템 정리
   docker system prune -a
   ```

4. **빌드 실패**

   ```bash
   # 캐시 없이 다시 빌드
   docker-compose -f docker-compose.prod.yml build --no-cache

   # 기존 이미지 제거 후 빌드
   docker rmi witchs-cauldron-frontend:latest
   docker-compose -f docker-compose.prod.yml build
   ```

5. **모듈을 찾을 수 없는 오류 (@tailwindcss/postcss, path aliases)**

   ```bash
   # 빌드 캐시 완전 정리
   docker builder prune -f
   docker system prune -a

   # 완전히 새로 빌드
   ./manage.sh clean
   ./deploy.sh --clean
   ```

6. **Docker Compose 버전 경고**

   - `version` 속성 관련 경고는 무시해도 안전합니다
   - 최신 Docker Compose에서는 version 속성이 필요하지 않습니다

7. **Tailwind CSS 빌드 오류**

   ```bash
   # devDependencies가 제대로 설치되었는지 확인
   docker run --rm -v $(pwd):/app -w /app node:22-alpine npm list --depth=0

   # PostCSS 설정 확인
   cat postcss.config.js
   ```

### 로그 확인

```bash
# 애플리케이션 로그
./manage.sh logs

# Docker 시스템 로그
sudo journalctl -u docker.service

# 시스템 리소스 모니터링
htop
```

## 🚀 프로덕션 권장사항

### 1. 리버스 프록시 설정 (Nginx)

```bash
# Nginx 설치
sudo apt install nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/witchs-cauldron
```

Nginx 설정 예시:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. SSL 인증서 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com
```

### 3. 방화벽 설정

```bash
# UFW 방화벽 설정
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
```

### 4. 자동 시작 설정

```bash
# Docker 자동 시작 설정
sudo systemctl enable docker

# 부팅 시 애플리케이션 자동 시작을 위한 systemd 서비스 생성
sudo nano /etc/systemd/system/witchs-cauldron.service
```

Systemd 서비스 파일:

```ini
[Unit]
Description=Witchs Cauldron Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/witchs-cauldron
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

서비스 활성화:

```bash
sudo systemctl enable witchs-cauldron
sudo systemctl start witchs-cauldron
```

## 📊 모니터링

### 시스템 리소스 모니터링

```bash
# 컨테이너 리소스 사용량
docker stats

# 시스템 리소스
htop
iostat
```

### 로그 로테이션

Docker 로그가 너무 커지지 않도록 로그 로테이션을 설정하세요:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## 🆘 지원

문제가 발생하면 다음을 확인하세요:

1. 로그 파일: `./manage.sh logs`
2. 컨테이너 상태: `./manage.sh status`
3. 시스템 리소스: `free -h`, `df -h`
4. 네트워크 연결: `curl http://localhost:3000`

---

**참고**: 이 가이드는 기본적인 배포 방법을 다룹니다. 프로덕션 환경에서는 보안, 성능, 모니터링 등을 추가로 고려해야 합니다.
