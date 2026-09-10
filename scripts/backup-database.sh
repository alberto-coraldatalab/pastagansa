#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment_file="${1:-$repository_root/.env.staging}"
backup_directory="${2:-$repository_root/backups}"
compose_file="$repository_root/docker-compose.staging.yml"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing staging environment file: $environment_file" >&2
  exit 1
fi

umask 077
mkdir -p "$backup_directory"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_directory/pastagansa-${timestamp}.dump"

docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres \
  pg_dump --username pastagansa_admin --dbname pastagansa --format=custom \
  --no-owner --no-acl >"$backup_file"

if [[ ! -s "$backup_file" ]]; then
  echo "Backup is empty: $backup_file" >&2
  exit 1
fi

echo "$backup_file"
