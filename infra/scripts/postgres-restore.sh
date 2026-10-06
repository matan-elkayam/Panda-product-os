#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: postgres-restore.sh <backup.dump>}"
FILE="$1"

[ -f "$FILE" ] || { echo "Backup not found: $FILE" >&2; exit 1; }
if [ -f "$FILE.sha256" ]; then
  sha256sum -c "$FILE.sha256"
fi

pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-acl "$FILE"
