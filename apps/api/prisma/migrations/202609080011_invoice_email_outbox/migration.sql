CREATE TYPE "InvoiceEmailStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "invoice_email_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "recipient" VARCHAR(320) NOT NULL,
  "subject" VARCHAR(300) NOT NULL,
  "status" "InvoiceEmailStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_email_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_email_deliveries_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "invoice_email_deliveries_state_check" CHECK (
    ("status" = 'SENT' AND "sent_at" IS NOT NULL)
    OR ("status" <> 'SENT' AND "sent_at" IS NULL)
  )
);

CREATE UNIQUE INDEX "invoice_email_deliveries_company_id_idempotency_key_key"
  ON "invoice_email_deliveries"("company_id", "idempotency_key");
CREATE INDEX "invoice_email_deliveries_status_available_at_idx"
  ON "invoice_email_deliveries"("status", "available_at");
CREATE INDEX "invoice_email_deliveries_invoice_id_created_at_idx"
  ON "invoice_email_deliveries"("invoice_id", "created_at");

ALTER TABLE "invoice_email_deliveries" ADD CONSTRAINT "invoice_email_deliveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_email_deliveries" ADD CONSTRAINT "invoice_email_deliveries_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_email_deliveries" ADD CONSTRAINT "invoice_email_deliveries_invoice_tenant_fkey"
  FOREIGN KEY ("invoice_id", "organization_id", "company_id")
  REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "invoice_email_deliveries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_email_deliveries_organization_isolation" ON "invoice_email_deliveries"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "invoice_email_deliveries" FORCE ROW LEVEL SECURITY;
