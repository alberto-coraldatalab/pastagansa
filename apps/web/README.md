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
