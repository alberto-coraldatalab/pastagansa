#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_file="${1:-}"
environment_file="${2:-$repository_root/.env.staging}"
compose_file="$repository_root/docker-compose.staging.yml"
drill_database="pastagansa_restore_drill"

if [[ -z "$backup_file" || ! -s "$backup_file" ]]; then
  echo "Usage: $0 BACKUP_FILE [ENV_FILE]" >&2
  exit 1
fi
if [[ ! -f "$environment_file" ]]; then
  echo "Missing staging environment file: $environment_file" >&2
  exit 1
fi

compose=(docker compose --env-file "$environment_file" -f "$compose_file")
drop_drill_database() {
  "${compose[@]}" exec -T postgres dropdb --if-exists --force \
    --username pastagansa_admin "$drill_database" >/dev/null
}
trap drop_drill_database EXIT

drop_drill_database
"${compose[@]}" exec -T postgres createdb --username pastagansa_admin "$drill_database"
"${compose[@]}" exec -T postgres pg_restore --username pastagansa_admin \
  --dbname "$drill_database" --exit-on-error --no-owner --no-acl <"$backup_file"

live_migrations="$("${compose[@]}" exec -T postgres psql --username pastagansa_admin \
  --dbname pastagansa --tuples-only --no-align \
  --command='SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')"
restored_migrations="$("${compose[@]}" exec -T postgres psql --username pastagansa_admin \
  --dbname "$drill_database" --tuples-only --no-align \
  --command='SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')"

if [[ "$live_migrations" -eq 0 || "$live_migrations" -ne "$restored_migrations" ]]; then
  echo "Restore drill failed: migration counts differ (${live_migrations}/${restored_migrations})." >&2
  exit 1
fi

count_query="SELECT concat_ws(':',
  (SELECT count(*) FROM organizations),
  (SELECT count(*) FROM companies),
  (SELECT count(*) FROM users),
  (SELECT count(*) FROM invoices),
  (SELECT count(*) FROM journal_entries)
)"
live_counts="$("${compose[@]}" exec -T postgres psql --username pastagansa_admin \
  --dbname pastagansa --tuples-only --no-align --command="$count_query")"
restored_counts="$("${compose[@]}" exec -T postgres psql --username pastagansa_admin \
  --dbname "$drill_database" --tuples-only --no-align --command="$count_query")"

if [[ "$live_counts" != "$restored_counts" ]]; then
  echo "Restore drill failed: critical row counts differ (${live_counts}/${restored_counts})." >&2
  exit 1
fi

"${compose[@]}" exec -T postgres psql --username pastagansa_admin \
  --dbname "$drill_database" --tuples-only --no-align \
  --command="SELECT to_regclass('public.organizations'), to_regclass('public.invoices'), to_regclass('public.journal_entries')" \
  | grep -q 'organizations|invoices|journal_entries'

echo "Restore drill passed with ${restored_migrations} migrations and matching critical row counts (${restored_counts})."
