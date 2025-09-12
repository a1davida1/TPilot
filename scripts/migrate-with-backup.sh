#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL must be set" >&2
  exit 1
fi

timestamp=$(date +%Y%m%d_%H%M%S)
backup="db_backup_${timestamp}.sql"
echo "Creating database backup ${backup}"
pg_dump "$DATABASE_URL" > "${backup}"

echo "Running migrations"
npx drizzle-kit migrate

echo "Migrations complete"