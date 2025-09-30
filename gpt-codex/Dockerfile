FROM node:22-bullseye

# 필요한 패키지 설치 (Homebrew 설치 및 curl 사용을 위해)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    procps \
    curl \
    file \
    git \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 비루트 사용자 생성 (Homebrew 설치용)
RUN useradd -m -s /bin/bash linuxbrew \
  && mkdir -p /home/linuxbrew \
  && chown -R linuxbrew:linuxbrew /home/linuxbrew

# Homebrew 설치 (비대화형) 및 PATH 설정 - linuxbrew 사용자로 실행
ENV NONINTERACTIVE=1
USER linuxbrew
RUN bash -lc "curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | bash" \
  && echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> /home/linuxbrew/.bashrc

# 모든 사용자에게 brew 경로 노출 및 심볼릭 링크 작성
USER root
ENV PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:${PATH}"
RUN if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then \
      ln -sf /home/linuxbrew/.linuxbrew/bin/brew /usr/local/bin/brew; \
    fi

# brew 및 npm 글로벌 패키지 설치 (공식 포뮬러/패키지 부재 시에도 빌드 계속)
RUN brew --version || true \
  && brew update || true \
  && brew install codex || true \
  && npm install -g @openai/codex || true

WORKDIR /srv
EXPOSE 8080
