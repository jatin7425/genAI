#!/usr/bin/env bash
# Local dev bootstrap: MongoDB (docker) + backend (uvicorn) + frontend (vite).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

cleanup() {
  echo "Stopping backend/frontend..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "Stopping mongo..."
  docker compose -f "$ROOT_DIR/local_dev/docker-compose.yml" down
}
trap cleanup EXIT INT TERM

echo "Starting mongo..."
COMPOSE_FILE="$ROOT_DIR/local_dev/docker-compose.yml"
# mongodb-atlas-local occasionally loses a startup race (mongod launches
# before its auth keyfile is written) and crashes on first boot — retrying
# with a clean volume reliably recovers.
MONGO_ATTEMPTS=3
for attempt in $(seq 1 "$MONGO_ATTEMPTS"); do
  if docker compose -f "$COMPOSE_FILE" up -d --wait; then
    break
  fi
  if [ "$attempt" -eq "$MONGO_ATTEMPTS" ]; then
    echo "mongo failed to become healthy after $MONGO_ATTEMPTS attempts." >&2
    exit 1
  fi
  echo "mongo didn't come up healthy (attempt $attempt/$MONGO_ATTEMPTS), retrying with a clean volume..."
  docker compose -f "$COMPOSE_FILE" down -v
done

echo "Starting backend..."
(
  cd "$ROOT_DIR/backend"
  source venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload
) &
PIDS+=($!)

echo "Starting frontend..."
(
  cd "$ROOT_DIR/frontend"
  npm run dev
) &
PIDS+=($!)

wait
