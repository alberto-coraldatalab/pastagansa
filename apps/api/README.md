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

`GET /v1/health` and the identity endpoints are public. `POST /v1/identity/register` creates an owner, organization, and first company atomically; `login` and `refresh` use Argon2id password/refresh-token hashes and rotate refresh tokens.

Future business controllers must use `@TenantProtected()`; the authentication and tenant guards then require a verified bearer token, check the requested organization/company against active memberships, and write the approved context to `request.tenant`.

Tenant selection headers (`x-organization-id`, `x-company-id`) are never authorization. They are only candidates validated against the database membership.

## Database safety

The first migration applies organization row-level-security policies to tenant-bearing tables as a second barrier. Production requests must use a non-owner application database role and issue `SET LOCAL app.organization_id` for every tenant-bound transaction; PostgreSQL table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is applied.
