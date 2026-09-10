#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment_file="${1:-$repository_root/.env.staging}"
compose_file="$repository_root/docker-compose.staging.yml"

if [[ ! -f "$environment_file" ]]; then
  echo "Missing staging environment file: $environment_file" >&2
  exit 1
fi

docker compose --env-file "$environment_file" -f "$compose_file" exec -T \
  -e DEMO_API_URL=http://127.0.0.1:3000 \
  -e DEMO_EMAIL="${DEMO_EMAIL:-demo@pastagansa.local}" \
  -e DEMO_PASSWORD="${DEMO_PASSWORD:-DemoPastagansa2026!}" \
  api node /app/scripts/seed-demo.mjs
