#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
SHARED_CLIPS_DIR="$ROOT_DIR/shared/clips"
LOG_DIR="/tmp/witchs-cauldron"
mkdir -p "$LOG_DIR" "$SHARED_CLIPS_DIR"

FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_LOG="$LOG_DIR/backend.log"
PIP_LOG="$LOG_DIR/backend-pip.log"

sync_frontend_env() {
  local root_env="$ROOT_DIR/.env"
  local fe_env="$FRONTEND_DIR/.env.local"

  if [ -f "$root_env" ]; then
    if [ ! -f "$fe_env" ] || ! cmp -s "$root_env" "$fe_env"; then
      cp "$root_env" "$fe_env"
      echo "[run-local] synced env: .env -> frontend/.env.local"
    else
      echo "[run-local] env already in sync"
    fi
  else
    echo "[run-local] root .env not found (skip env sync)"
  fi
}

start() {
  sync_frontend_env

  echo "[run-local] starting frontend..."
  if pgrep -f "next dev -p 3000" >/dev/null; then
    echo "[run-local] frontend already running on :3000"
  else
    (cd "$FRONTEND_DIR" && nohup npm run dev >"$FRONTEND_LOG" 2>&1 &)
    sleep 2
  fi

  echo "[run-local] starting backend..."
  (
    cd "$BACKEND_DIR"
    if [ ! -d .venv ]; then
      python3 -m venv .venv
    fi
    # shellcheck disable=SC1091
    source .venv/bin/activate
    pip install -r requirements.txt >"$PIP_LOG" 2>&1
    pkill -f "uvicorn app.main:app --host 0.0.0.0 --port 8000" || true
    CLIPS_DIR="$SHARED_CLIPS_DIR" nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 >"$BACKEND_LOG" 2>&1 &
  )

  sleep 3
  echo "[run-local] health checks"
  echo -n "  frontend: " && curl -fsS http://127.0.0.1:3000/api/health || true
  echo
  echo -n "  backend : " && curl -fsS http://127.0.0.1:8000/api/health || true
  echo
  echo "[run-local] done"
}

stop() {
  echo "[run-local] stopping services..."
  pkill -f "next dev -p 3000" || true
  pkill -f "uvicorn app.main:app --host 0.0.0.0 --port 8000" || true
  echo "[run-local] stopped"
}

status() {
  echo "[run-local] process status"
  ss -ltnp | grep -E ':3000|:8000' || echo "No listeners on 3000/8000"
  echo
  echo "[run-local] health"
  echo -n "  frontend: " && curl -sS -m 3 http://127.0.0.1:3000/api/health || true
  echo
  echo -n "  backend : " && curl -sS -m 3 http://127.0.0.1:8000/api/health || true
  echo
}

logs() {
  echo "=== frontend log: $FRONTEND_LOG ==="
  tail -n 80 "$FRONTEND_LOG" 2>/dev/null || true
  echo
  echo "=== backend log: $BACKEND_LOG ==="
  tail -n 80 "$BACKEND_LOG" 2>/dev/null || true
  echo
  echo "=== backend pip log: $PIP_LOG ==="
  tail -n 40 "$PIP_LOG" 2>/dev/null || true
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) logs ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
