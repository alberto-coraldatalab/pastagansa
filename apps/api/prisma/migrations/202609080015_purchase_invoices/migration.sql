ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'PURCHASE_INVOICE';

CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELLED');

CREATE TABLE "purchase_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "sequence_id" UUID,
  "draft_code" VARCHAR(40) NOT NULL,
  "supplier_invoice_number" VARCHAR(100) NOT NULL,
  "reception_series" VARCHAR(30),
  "reception_number" BIGINT,
  "reception_full_number" VARCHAR(80),
  "approval_key" VARCHAR(128),
  "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "supplier_legal_name" VARCHAR(240) NOT NULL,
  "supplier_tax_id" VARCHAR(40),
  "issue_date" DATE NOT NULL,
  "operation_date" DATE NOT NULL,
  "received_date" DATE NOT NULL,
  "deduction_date" DATE NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "notes" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount_total" DECIMAL(14,2) NOT NULL,
  "tax_total" DECIMAL(14,2) NOT NULL,
  "deductible_tax_total" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "approved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoices_dates_check" CHECK (
    "operation_date" <= "issue_date"
    AND "received_date" >= "issue_date"
    AND "deduction_date" >= "received_date"
  ),
  CONSTRAINT "purchase_invoices_totals_check" CHECK (
    "subtotal" >= 0 AND "discount_total" >= 0 AND "tax_total" >= 0
    AND "deductible_tax_total" >= 0 AND "deductible_tax_total" <= "tax_total"
    AND "total" >= 0
  ),
  CONSTRAINT "purchase_invoices_approval_check" CHECK (
    ("status" = 'DRAFT' AND "sequence_id" IS NULL AND "reception_number" IS NULL
      AND "reception_series" IS NULL AND "reception_full_number" IS NULL
      AND "approval_key" IS NULL AND "approved_at" IS NULL)
    OR
    ("status" = 'APPROVED' AND "sequence_id" IS NOT NULL AND "reception_number" IS NOT NULL
      AND "reception_series" IS NOT NULL AND "reception_full_number" IS NOT NULL
      AND "approval_key" IS NOT NULL AND "approved_at" IS NOT NULL)
    OR "status" = 'CANCELLED'
  )
);

CREATE UNIQUE INDEX "purchase_invoices_company_id_draft_code_key"
  ON "purchase_invoices"("company_id", "draft_code");
CREATE UNIQUE INDEX "purchase_invoices_supplier_number_key"
  ON "purchase_invoices"("company_id", "supplier_id", "supplier_invoice_number");
CREATE UNIQUE INDEX "purchase_invoices_reception_number_key"
  ON "purchase_invoices"("company_id", "reception_series", "reception_number");
CREATE UNIQUE INDEX "purchase_invoices_approval_key_key"
  ON "purchase_invoices"("company_id", "approval_key");
CREATE UNIQUE INDEX "purchase_invoices_id_tenant_key"
  ON "purchase_invoices"("id", "organization_id", "company_id");
CREATE INDEX "purchase_invoices_company_status_received_idx"
  ON "purchase_invoices"("company_id", "status", "received_date");

ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_tenant_fkey"
  FOREIGN KEY ("supplier_id", "organization_id", "company_id")
  REFERENCES "contacts"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_sequence_tenant_fkey"
  FOREIGN KEY ("sequence_id", "organization_id", "company_id")
  REFERENCES "document_sequences"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE TABLE "purchase_invoice_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "catalog_item_id" UUID,
  "position" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "net_amount" DECIMAL(14,2) NOT NULL,
  "tax_amount" DECIMAL(14,2) NOT NULL,
  "total_amount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_lines_values_check" CHECK (
    "quantity" > 0 AND "unit_price" >= 0 AND "discount_pct" BETWEEN 0 AND 100
    AND "net_amount" >= 0 AND "tax_amount" >= 0 AND "total_amount" >= 0
  )
);

CREATE UNIQUE INDEX "purchase_invoice_lines_invoice_position_key"
  ON "purchase_invoice_lines"("purchase_invoice_id", "position");
CREATE UNIQUE INDEX "purchase_invoice_lines_id_invoice_tenant_key"
  ON "purchase_invoice_lines"("id", "purchase_invoice_id", "organization_id", "company_id");

ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_catalog_item_id_fkey"
  FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT;

CREATE TABLE "purchase_tax_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "purchase_invoice_line_id" UUID NOT NULL,
  "tax_rule_id" UUID NOT NULL,
  "tax_code" VARCHAR(80) NOT NULL,
  "taxable_base" DECIMAL(14,2) NOT NULL,
  "tax_rate" DECIMAL(9,6),
  "tax_amount" DECIMAL(14,2) NOT NULL,
  "deductible_pct" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "deductible_amount" DECIMAL(14,2) NOT NULL,
  "subject" BOOLEAN NOT NULL,
  "exempt" BOOLEAN NOT NULL,
  "exemption_reason" VARCHAR(100),
  "reverse_charge" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_tax_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_tax_lines_amounts_check" CHECK (
    "taxable_base" >= 0 AND "tax_amount" >= 0
    AND "deductible_pct" BETWEEN 0 AND 100
    AND "deductible_amount" >= 0 AND "deductible_amount" <= "tax_amount"
  ),
  CONSTRAINT "purchase_tax_lines_exemption_check" CHECK (
    ("exempt" AND length(btrim("exemption_reason")) > 0 AND "tax_amount" = 0)
    OR (NOT "exempt" AND "exemption_reason" IS NULL)
  )
);

CREATE UNIQUE INDEX "purchase_tax_lines_invoice_line_key"
  ON "purchase_tax_lines"("purchase_invoice_line_id");
CREATE UNIQUE INDEX "purchase_tax_lines_id_tenant_key"
  ON "purchase_tax_lines"("id", "organization_id", "company_id");
CREATE INDEX "purchase_tax_lines_invoice_id_idx"
  ON "purchase_tax_lines"("purchase_invoice_id");

ALTER TABLE "purchase_tax_lines" ADD CONSTRAINT "purchase_tax_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_tax_lines" ADD CONSTRAINT "purchase_tax_lines_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_tax_lines" ADD CONSTRAINT "purchase_tax_lines_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "purchase_tax_lines" ADD CONSTRAINT "purchase_tax_lines_line_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_line_id", "purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoice_lines"("id", "purchase_invoice_id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "purchase_tax_lines" ADD CONSTRAINT "purchase_tax_lines_tax_rule_id_fkey"
  FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE RESTRICT;

ALTER TABLE "tax_ledger_entries" ALTER COLUMN "invoice_id" DROP NOT NULL;
ALTER TABLE "tax_ledger_entries" ADD COLUMN "purchase_invoice_id" UUID;
ALTER TABLE "tax_ledger_entries" ADD COLUMN "received_date" DATE;
ALTER TABLE "tax_ledger_entries" ADD COLUMN "registration_number" VARCHAR(80);
ALTER TABLE "tax_ledger_entries" ADD CONSTRAINT "tax_ledger_entries_source_check"
  CHECK (num_nonnulls("invoice_id", "purchase_invoice_id") = 1);
CREATE UNIQUE INDEX "tax_ledger_entries_purchase_invoice_id_key"
  ON "tax_ledger_entries"("purchase_invoice_id");
CREATE UNIQUE INDEX "tax_ledger_entries_purchase_invoice_tenant_key"
  ON "tax_ledger_entries"("purchase_invoice_id", "organization_id", "company_id");
ALTER TABLE "tax_ledger_entries" ADD CONSTRAINT "tax_ledger_entries_purchase_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "tax_ledger_amounts" ALTER COLUMN "invoice_tax_line_id" DROP NOT NULL;
ALTER TABLE "tax_ledger_amounts" ADD COLUMN "purchase_tax_line_id" UUID;
ALTER TABLE "tax_ledger_amounts" ADD COLUMN "deductible_amount" DECIMAL(14,2);
ALTER TABLE "tax_ledger_amounts" ADD CONSTRAINT "tax_ledger_amounts_source_check"
  CHECK (num_nonnulls("invoice_tax_line_id", "purchase_tax_line_id") = 1);
CREATE UNIQUE INDEX "tax_ledger_amounts_entry_purchase_tax_line_key"
  ON "tax_ledger_amounts"("tax_ledger_entry_id", "purchase_tax_line_id");
ALTER TABLE "tax_ledger_amounts" ADD CONSTRAINT "tax_ledger_amounts_purchase_tax_line_tenant_fkey"
  FOREIGN KEY ("purchase_tax_line_id", "organization_id", "company_id")
  REFERENCES "purchase_tax_lines"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "purchase_invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_invoices_organization_isolation" ON "purchase_invoices"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_invoices" FORCE ROW LEVEL SECURITY;

ALTER TABLE "purchase_invoice_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_invoice_lines_organization_isolation" ON "purchase_invoice_lines"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_invoice_lines" FORCE ROW LEVEL SECURITY;

ALTER TABLE "purchase_tax_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_tax_lines_organization_isolation" ON "purchase_tax_lines"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_tax_lines" FORCE ROW LEVEL SECURITY;

CREATE FUNCTION enforce_purchase_invoice_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'approved purchase invoices are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "purchase_invoices_immutability"
BEFORE UPDATE OR DELETE ON "purchase_invoices"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_invoice_immutability();

CREATE FUNCTION enforce_purchase_invoice_child_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_status "PurchaseInvoiceStatus";
  parent_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN parent_id := OLD."purchase_invoice_id";
  ELSE parent_id := NEW."purchase_invoice_id";
  END IF;
  SELECT "status" INTO parent_status FROM "purchase_invoices" WHERE "id" = parent_id;
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'approved purchase invoice contents are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "purchase_invoice_lines_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_invoice_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_invoice_child_immutability();
CREATE TRIGGER "purchase_tax_lines_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_tax_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_invoice_child_immutability();

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'purchase_invoice.read', 'Read purchase invoices'),
  (gen_random_uuid(), 'purchase_invoice.create', 'Create purchase invoices'),
  (gen_random_uuid(), 'purchase_invoice.update', 'Update purchase invoices'),
  (gen_random_uuid(), 'purchase_invoice.approve', 'Approve purchase invoices'),
  (gen_random_uuid(), 'purchase_invoice.delete', 'Delete purchase invoice drafts')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner'
  AND p."code" LIKE 'purchase_invoice.%'
ON CONFLICT DO NOTHING;
