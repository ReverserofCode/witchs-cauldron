#!/usr/bin/env bash
set -euo pipefail

# System deps for Playwright Chromium on Ubuntu/WSL
sudo apt-get update
sudo apt-get install -y \
  libnspr4 libnss3 libatk-bridge2.0-0 libatk1.0-0 \
  libdrm2 libxkbcommon0 libgbm1 libasound2t64 libatspi2.0-0 \
  libxshmfence1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgtk-3-0

# Browser runtime
npx playwright install chromium

echo "[setup-screenshot-deps] done"
