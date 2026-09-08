# API platform foundation

Initial implementation of the Platform Ready milestone: multi-organization data, company-scoped memberships, audit events, and a tenant guard.

## Local run

```bash
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

`GET /v1/health` is public. Future business controllers must use `@TenantProtected()`; the global `TenantGuard` then requires a verified `request.user`, checks the requested organization/company against active memberships, and writes the approved context to `request.tenant`.

Tenant selection headers (`x-organization-id`, `x-company-id`) are never authorization. They are only candidates validated against the database membership.

## Database safety

The first migration applies organization row-level-security policies to tenant-bearing tables as a second barrier. Production requests must use a non-owner application database role and issue `SET LOCAL app.organization_id` for every tenant-bound transaction; PostgreSQL table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is applied.
