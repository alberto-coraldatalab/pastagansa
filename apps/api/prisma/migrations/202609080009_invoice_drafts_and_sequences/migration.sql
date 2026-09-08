CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'RECTIFIED', 'CANCELLED');

CREATE TABLE "document_sequences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "document_type" "DocumentType" NOT NULL,
  "series" VARCHAR(30) NOT NULL,
  "next_number" BIGINT NOT NULL DEFAULT 1,
  "padding" INTEGER NOT NULL DEFAULT 4,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_sequences_next_number_check" CHECK ("next_number" > 0),
  CONSTRAINT "document_sequences_padding_check" CHECK ("padding" BETWEEN 1 AND 12)
);

CREATE TABLE "invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "sequence_id" UUID,
  "draft_code" VARCHAR(40) NOT NULL,
  "series" VARCHAR(30),
  "number" BIGINT,
  "full_number" VARCHAR(80),
  "issuance_key" VARCHAR(128),
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issuer_legal_name" VARCHAR(240) NOT NULL,
  "issuer_tax_id" VARCHAR(40) NOT NULL,
  "customer_legal_name" VARCHAR(240) NOT NULL,
  "customer_tax_id" VARCHAR(40),
  "customer_email" VARCHAR(320),
  "billing_address" JSONB,
  "issue_date" DATE NOT NULL,
  "due_date" DATE,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "notes" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_total" DECIMAL(14,2) NOT NULL,
  "tax_total" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "issued_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_due_date_check" CHECK ("due_date" IS NULL OR "due_date" >= "issue_date"),
  CONSTRAINT "invoices_totals_check" CHECK ("subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0 AND "total" >= 0),
  CONSTRAINT "invoices_numbering_consistency_check" CHECK (
    ("status" = 'DRAFT' AND "sequence_id" IS NULL AND "series" IS NULL AND "number" IS NULL AND "full_number" IS NULL AND "issuance_key" IS NULL AND "issued_at" IS NULL)
    OR
    ("status" <> 'DRAFT' AND "sequence_id" IS NOT NULL AND "series" IS NOT NULL AND "number" IS NOT NULL AND "full_number" IS NOT NULL AND "issuance_key" IS NOT NULL AND "issued_at" IS NOT NULL)
  )
);

CREATE TABLE "invoice_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "catalog_item_id" UUID,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "net_amount" DECIMAL(14,2) NOT NULL,
  "tax_amount" DECIMAL(14,2) NOT NULL,
  "total_amount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_lines_position_check" CHECK ("position" > 0),
  CONSTRAINT "invoice_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "invoice_lines_unit_price_check" CHECK ("unit_price" >= 0),
  CONSTRAINT "invoice_lines_discount_check" CHECK ("discount_pct" BETWEEN 0 AND 100),
  CONSTRAINT "invoice_lines_tax_rate_check" CHECK ("tax_rate" BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX "document_sequences_company_id_document_type_series_key" ON "document_sequences"("company_id", "document_type", "series");
CREATE UNIQUE INDEX "document_sequences_id_organization_id_company_id_key" ON "document_sequences"("id", "organization_id", "company_id");
CREATE INDEX "document_sequences_company_id_document_type_active_idx" ON "document_sequences"("company_id", "document_type", "active");
CREATE UNIQUE INDEX "invoices_company_id_draft_code_key" ON "invoices"("company_id", "draft_code");
CREATE UNIQUE INDEX "invoices_company_id_series_number_key" ON "invoices"("company_id", "series", "number");
CREATE UNIQUE INDEX "invoices_company_id_issuance_key_key" ON "invoices"("company_id", "issuance_key");
CREATE UNIQUE INDEX "invoices_id_organization_id_company_id_key" ON "invoices"("id", "organization_id", "company_id");
CREATE INDEX "invoices_company_id_status_issue_date_idx" ON "invoices"("company_id", "status", "issue_date");
CREATE UNIQUE INDEX "invoice_lines_invoice_id_position_key" ON "invoice_lines"("invoice_id", "position");

ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_tenant_fkey" FOREIGN KEY ("contact_id", "organization_id", "company_id") REFERENCES "contacts"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sequence_tenant_fkey" FOREIGN KEY ("sequence_id", "organization_id", "company_id") REFERENCES "document_sequences"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_tenant_fkey" FOREIGN KEY ("invoice_id", "organization_id", "company_id") REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_catalog_tenant_fkey" FOREIGN KEY ("catalog_item_id", "organization_id", "company_id") REFERENCES "catalog_items"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "document_sequences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_sequences_organization_isolation" ON "document_sequences" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid) WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "document_sequences" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_organization_isolation" ON "invoices" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid) WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_lines_organization_isolation" ON "invoice_lines" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid) WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "invoice_lines" FORCE ROW LEVEL SECURITY;

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'document_sequence.read', 'Read document sequences'),
  (gen_random_uuid(), 'document_sequence.manage', 'Manage document sequences'),
  (gen_random_uuid(), 'invoice.read', 'Read invoices'),
  (gen_random_uuid(), 'invoice.create', 'Create invoice drafts'),
  (gen_random_uuid(), 'invoice.update', 'Update invoice drafts'),
  (gen_random_uuid(), 'invoice.delete', 'Delete invoice drafts'),
  (gen_random_uuid(), 'invoice.issue', 'Issue invoices'),
  (gen_random_uuid(), 'invoice.send', 'Send invoices')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner' AND p."code" IN (
  'document_sequence.read', 'document_sequence.manage', 'invoice.read', 'invoice.create',
  'invoice.update', 'invoice.delete', 'invoice.issue', 'invoice.send'
)
ON CONFLICT DO NOTHING;
