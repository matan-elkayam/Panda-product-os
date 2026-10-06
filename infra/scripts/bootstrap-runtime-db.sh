#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/panda/product-os/staging}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-panda-product-os-staging}"

log() { printf '[panda-db-bootstrap] %s\n' "$*"; }
fail() { log "ERROR: $*"; exit 1; }

cd "$APP_DIR" || fail "APP_DIR does not exist: $APP_DIR"
[ -f .env ] || fail "Missing .env"
chmod 600 .env

set -a
# shellcheck disable=SC1091
source .env
set +a

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is required"
[ -n "${POSTGRES_DB:-}" ] || fail "POSTGRES_DB is required"
[ -n "${POSTGRES_USER:-}" ] || fail "POSTGRES_USER is required"

# On first run the existing DATABASE_URL is the database-owner connection.
if ! grep -q '^MIGRATION_DATABASE_URL=' .env; then
  printf '\nMIGRATION_DATABASE_URL=%s\n' "$DATABASE_URL" >> .env
  MIGRATION_DATABASE_URL="$DATABASE_URL"
  log "Preserved existing owner connection as MIGRATION_DATABASE_URL"
fi

if ! grep -q '^RUNTIME_DB_PASSWORD=' .env; then
  RUNTIME_DB_PASSWORD="$(openssl rand -hex 32)"
  printf 'RUNTIME_DB_PASSWORD=%s\n' "$RUNTIME_DB_PASSWORD" >> .env
  log "Generated runtime database password"
else
  RUNTIME_DB_PASSWORD="$(grep '^RUNTIME_DB_PASSWORD=' .env | tail -1 | cut -d= -f2-)"
fi

export COMPOSE_PROJECT_NAME
compose() { docker compose --env-file .env -f "$COMPOSE_FILE" "$@"; }

compose up -d postgres
for attempt in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  [ "$attempt" -lt 30 ] || fail "PostgreSQL readiness timed out"
  sleep 2
done

# panda_runtime is created by migration 004. The login role owns nothing and inherits
# only the explicit panda_runtime privileges/RLS behavior.
compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v runtime_password="$RUNTIME_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE panda_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'panda_app') \gexec
SELECT format('ALTER ROLE panda_app PASSWORD %L', :'runtime_password') \gexec
GRANT panda_runtime TO panda_app;
SQL

RUNTIME_URL="postgresql://panda_app:${RUNTIME_DB_PASSWORD}@postgres:5432/${POSTGRES_DB}"
if grep -q '^DATABASE_URL=' .env; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${RUNTIME_URL}|" .env
else
  printf 'DATABASE_URL=%s\n' "$RUNTIME_URL" >> .env
fi
chmod 600 .env

log "Runtime role panda_app provisioned"
log "DATABASE_URL now uses panda_app; MIGRATION_DATABASE_URL remains the privileged owner connection"
log "No secret values were printed"
