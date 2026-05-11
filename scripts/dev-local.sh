#!/usr/bin/env bash
# Start API + Vite for local development. Loads env from repo-root `.env` via
# env-bootstrap (API) and Vite envDir (client). Do not set PORT= for Vite; use
# DEV_CLIENT_PORT in .env if you need a custom frontend port.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running; using existing PostgreSQL on localhost if any."
  else
    docker compose up -d db 2>/dev/null || true
  fi
fi

pnpm --filter @workspace/db run push-force
pnpm --filter @workspace/api-server run build

pnpm --filter @workspace/api-server exec node --enable-source-maps ./dist/index.mjs &
API_PID=$!

cd "$ROOT/artifacts/poultry-manager"
pnpm run dev &
WEB_PID=$!

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait "$API_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "API PID=$API_PID  WEB PID=$WEB_PID — open http://localhost:5173 (API http://localhost:8080)"
wait "$API_PID" "$WEB_PID"
