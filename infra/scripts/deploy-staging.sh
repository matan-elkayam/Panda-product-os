#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/panda/product-os/staging}"
BRANCH="${BRANCH:-foundation/m0-engineering}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-panda-product-os-staging}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${WEB_PORT:-3100}/api/health/ready}"

export COMPOSE_PROJECT_NAME

log() { printf '[panda-deploy] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }
compose() { docker compose --env-file .env -f "$COMPOSE_FILE" "$@"; }

command -v git >/dev/null || fail "git is required"
command -v docker >/dev/null || fail "docker is required"
command -v curl >/dev/null || fail "curl is required"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is required"

cd "$APP_DIR" || fail "APP_DIR does not exist: $APP_DIR"
[ -f .env ] || fail "Missing $APP_DIR/.env"
[ -f "$COMPOSE_FILE" ] || fail "Missing compose file: $COMPOSE_FILE"

log "Fetching $BRANCH"
git fetch --prune origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

log "Building staging images"
compose build --pull

log "Starting PostgreSQL and Redis"
compose up -d postgres redis

log "Waiting for PostgreSQL readiness"
for attempt in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U "${POSTGRES_USER:-panda_staging}" -d "${POSTGRES_DB:-panda_product_os_staging}" >/dev/null 2>&1; then
    log "PostgreSQL is READY"
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    compose logs --tail=120 postgres || true
    fail "PostgreSQL readiness timed out"
  fi
  sleep 2
done

log "Applying database migrations from worker image"
compose run --rm --no-deps worker pnpm --filter @panda/database migrate

log "Starting staging application"
compose up -d --remove-orphans

log "Waiting for readiness at $HEALTH_URL"
for attempt in $(seq 1 45); do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
    log "Staging is READY"
    compose ps
    exit 0
  fi
  sleep 2
done

compose ps || true
compose logs --tail=160 web worker postgres redis || true
fail "Readiness check failed: $HEALTH_URL"
