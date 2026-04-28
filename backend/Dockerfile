# Backend Dockerfile - Python + Selenium + Chromium + Xvfb
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install Chromium, Xvfb, and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    # Xvfb for virtual display (required for video playback)
    xvfb \
    x11-utils \
    # FFmpeg for HLS download
    ffmpeg \
    # Required for Selenium
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    # Utilities
    gosu \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome paths and display for Selenium
ENV CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver \
    DISPLAY=:99

# Create X11 socket directory for Xvfb (must be done as root before switching user)
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

# Create non-root user
RUN groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# Set working directory
WORKDIR /app

# Copy requirements first (for caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create shared clips directory
RUN mkdir -p /app/shared/clips && chown -R appuser:appuser /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run Xvfb and uvicorn
# Xvfb creates a virtual display for Chrome to render video properly
CMD ["sh", "-lc", "Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp & sleep 2 && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
