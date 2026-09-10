#!/bin/sh
set -eu

if [ -z "${DIRECT_DATABASE_URL:-}" ]; then
  echo "DIRECT_DATABASE_URL is required to apply database migrations" >&2
  exit 1
fi

DATABASE_URL="$DIRECT_DATABASE_URL" ./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
exec node apps/api/dist/main.js
