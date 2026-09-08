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

`/v1/invoices` supports draft creation, atomic issuance through a company document sequence, official PDF download, and transactional email enqueueing. Issuance and email requests require an `Idempotency-Key` header. Once issued, invoice headers and lines are immutable at the database layer.

Invoice lines resolve a versioned fiscal rule for their issue date and persist an immutable tax snapshot. The common Spanish VAT rates of 21%, 10%, and 4% remain backwards-compatible through `taxRate`; zero-rated, exempt, and non-subject operations require an explicit `taxRuleId` because they are legally distinct. Exempt operations also require `exemptionReason`.

`GET /v1/tax-rules?effectiveOn=YYYY-MM-DD` returns the rules applicable on a date. Rules are append-versioned: existing versions cannot be edited or deleted.

Issuing an invoice posts its frozen breakdown to the append-only Tax Ledger in the same transaction. `GET /v1/tax-ledger` supports date, direction, book, and cursor filters; `GET /v1/tax-ledger/:id` returns one entry. Decreasing rectifications post negative bases and quotas linked to the corrected entry. Both endpoints are company-scoped and protected by RLS.

`/v1/purchase-invoices` provides company-scoped supplier invoice drafts with supplier snapshots, duplicate supplier-number protection, fiscal lines, and partial input-VAT deductibility. Approval through `POST /v1/purchase-invoices/:id/approve` requires an idempotency key and a `PURCHASE_INVOICE` reception sequence, freezes the document, and posts it to the received-invoices Tax Ledger in the same transaction. `GET` and `POST /v1/purchase-invoices/:id/payments` expose and record append-only, idempotent supplier payments; each payment reduces the protected payable balance and posts suppliers against bank atomically. The ledger retains the supplier document number, internal reception number, issue/operation/receipt dates, deduction date, supported VAT, and deductible VAT.

`/v1/accounting` exposes the company chart of accounts, fiscal years and monthly periods, journal entries, reversals, and a date-filtered trial balance. A small PGC-inspired default chart is created on demand. Issuing a sales invoice, approving a supplier invoice, or recording a customer/supplier payment posts its balanced entry atomically with the source operation; non-deductible input VAT is included in purchase expense. Manual posting and reversal require an `Idempotency-Key`. Posted entries and lines are database-immutable, numbering is serialized per fiscal year, and locked periods reject new postings.

`/v1/banking/accounts` links a bank account to an active reconcilable ledger account. `POST /v1/banking/transactions/import` atomically imports normalized bank transactions with duplicate external-ID protection. Unmatched transactions can be listed and inspected for exact-amount journal suggestions within a configurable date window. `POST /v1/banking/transactions/:id/reconcile` explicitly confirms one suggestion; the database enforces matching direction, amount, ledger account, posted status, one-to-one use, and append-only reconciliation. Bank data never creates tax records.

`POST /v1/invoices/:id/rectifications` creates a rectifying draft linked to an issued standard invoice. Total rectifications copy the frozen original lines; partial and difference rectifications require explicit lines. Rectifications record their reason and increase/decrease impact, use a `CREDIT_NOTE` sequence at issuance, and are included in the same PDF, email, tenant, audit, idempotency, and immutability guarantees. Concurrent issuance is serialized against the original invoice so decreases cannot exceed its corrected balance.

`PUT /v1/invoices/:id/payment-schedule` replaces the installments of a standard invoice draft; installment amounts must add up exactly to the invoice total. Issuance creates one default installment when no custom schedule exists and then freezes its commercial fields. `POST /v1/invoices/:id/payments` records an idempotent manual collection, allocates it to the oldest open installments, rejects overpayment, atomically posts bank against customer receivables, and updates the invoice balance and `PARTIALLY_PAID`/`PAID` status. `GET /v1/invoices/:id/payment-schedule` and `GET /v1/invoices/:id/payments` expose the resulting detail. Recorded payments and allocations are append-only.

Invoice email delivery remains safely pending until SMTP is configured. Set `SMTP_HOST`, `SMTP_FROM`, and optionally `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD`; authenticated SMTP requires both user and password. The outbox worker also requires `DIRECT_DATABASE_URL` so it can discover tenant queues before processing each delivery through an organization-scoped RLS transaction. Delivery is at-least-once and retries transient failures up to five attempts with exponential backoff.

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

The integration suite requires PostgreSQL with all migrations applied. CI provisions PostgreSQL, deploys migrations, and exercises tenant isolation, quotation persistence and races, refresh-token concurrency, revocation, invoice issuance concurrency, supplier-invoice approval and payment, fiscal snapshot immutability, issued/received Tax Ledger posting, automatic and manual accounting entries, reversal, period locking, bank-transaction import and reconciliation, and audit visibility.

OpenAPI is served at `/docs` and Prometheus-format metrics at `/v1/metrics`. Every response receives an `x-request-id`; errors include the same identifier.
