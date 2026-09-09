# PastaGansa web

The Next.js application runs on `http://localhost:3001` and connects to the API through server-side route handlers. Copy `.env.example` to `.env.local` only when the API is not available at the default `http://localhost:3000` address.

Authentication tokens are stored in secure, HTTP-only cookies and are never exposed to browser JavaScript. Tenant identifiers selected from the authenticated identity context are also server-only; the API still validates them against active memberships on every protected request.

The first sales workflow is available at `/clientes`: it lists, searches, paginates,
and creates customers through server-side API routes that attach the authorized
tenant context.

`/catalogo` provides the equivalent workflow for products and services, including
reusable price, unit, VAT suggestion, and revenue account defaults.

`/facturas` lists sales documents by status and creates invoice drafts with multiple
lines. Customer and catalog selection stay in the browser workflow, while tax and
document totals remain calculated and validated by the API.

Each document has a detail view. Drafts can be edited and issued after an explicit
confirmation, using an existing invoice series or creating the first one in context.
Issuance retries reuse their idempotency key. Issued documents expose their official
PDF through the authenticated server route.

Issued invoices also show their payment schedule, outstanding balance, and payment
history. Partial and final payments can be recorded with method and reference;
browser retries preserve the idempotency key so the same payment is not duplicated.

Issued invoice details also expose the journal entry and VAT ledger record generated
by the API. The complete sales flow is covered by Playwright in `e2e/`; after building
both workspaces and preparing PostgreSQL, install Chromium with
`npx playwright install chromium` and run `npm run test:e2e` from the repository root.
