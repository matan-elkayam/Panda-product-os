#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/panda/product-os/staging}"
BRANCH="${BRANCH:-foundation/m0-engineering}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3100/api/health/ready}"

log() { printf '[panda-deploy] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

command -v git >/dev/null || fail "git is required"
command -v docker >/dev/null || fail "docker is required"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is required"

cd "$APP_DIR" || fail "APP_DIR does not exist: $APP_DIR"
[ -f .env ] || fail "Missing $APP_DIR/.env"
[ -f "$COMPOSE_FILE" ] || fail "Missing compose file: $COMPOSE_FILE"

log "Fetching $BRANCH"
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

log "Building staging images"
docker compose --env-file .env -f "$COMPOSE_FILE" build --pull

log "Applying database migrations"
docker compose --env-file .env -f "$COMPOSE_FILE" run --rm web pnpm --filter @panda/database migrate

log "Starting staging stack"
docker compose --env-file .env -f "$COMPOSE_FILE" up -d --remove-orphans

log "Waiting for readiness"
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
    log "Staging is READY"
    docker compose --env-file .env -f "$COMPOSE_FILE" ps
    exit 0
  fi
  sleep 2
done

docker compose --env-file .env -f "$COMPOSE_FILE" ps || true
docker compose --env-file .env -f "$COMPOSE_FILE" logs --tail=120 web worker || true
fail "Readiness check failed: $HEALTH_URL"
