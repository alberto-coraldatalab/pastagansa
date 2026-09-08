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

`GET` and `PATCH /v1/companies/current` are the first company-scoped endpoints. They require tenant headers, a bearer token, and the `company.read` or `company.update` permission respectively. Company updates are recorded in `audit_events`.

`/v1/contacts` provides company-scoped customer/supplier master data. Contact deletion is an archive operation; all writes carry tenant, permission, and audit enforcement.

`POST /v1/contacts/import` accepts an object with a `csv` string. Required headers are `legal_name,trade_name,tax_id,email,phone,is_customer,is_supplier`; the import validates every row, rejects duplicate tax IDs, and executes atomically.

`/v1/catalog-items` manages products and services, including commercial defaults used when document lines are created. Tax codes are suggestions only; they will be resolved by the versioned fiscal engine, not trusted as tax calculations.

`POST /v1/catalog-items/import` accepts a `csv` string with the catalog fields in its documented header. It validates all rows and executes an all-or-nothing import.

Contact and catalog list endpoints return `{ data, nextCursor }`. Provide `cursor` from the previous response together with an optional `limit` (1–100) to fetch the next page; cursors are validated against the selected company.

Tenant selection headers (`x-organization-id`, `x-company-id`) are never authorization. They are only candidates validated against the database membership.

## Database safety

Tenant-protected requests run inside one database transaction. The request interceptor sets `app.organization_id` on that transaction before domain work starts, and the database forces row-level security even for the table owner. Domain writes and their audit event therefore commit or roll back together.

## Verification

```bash
npm run lint
npm run build
npm test
npm run test:integration
npm audit --audit-level=high
```

The integration suite requires PostgreSQL with all migrations applied. CI provisions PostgreSQL, deploys migrations, exercises tenant isolation, quotation persistence and races, refresh-token concurrency, revocation, and audit visibility.

OpenAPI is served at `/docs` and Prometheus-format metrics at `/v1/metrics`. Every response receives an `x-request-id`; errors include the same identifier.
