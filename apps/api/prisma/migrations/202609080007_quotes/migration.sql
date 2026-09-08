CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organization_id" UUID NOT NULL, "company_id" UUID NOT NULL, "contact_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL DEFAULT gen_random_uuid()::text, "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT', "issue_date" DATE NOT NULL,
  "valid_until" DATE, "currency" CHAR(3) NOT NULL DEFAULT 'EUR', "notes" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL, "discount_total" DECIMAL(14,2) NOT NULL, "tax_total" DECIMAL(14,2) NOT NULL, "total" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "quote_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "quote_id" UUID NOT NULL, "organization_id" UUID NOT NULL, "company_id" UUID NOT NULL, "position" INTEGER NOT NULL, "catalog_item_id" UUID,
  "description" TEXT NOT NULL, "quantity" DECIMAL(14,3) NOT NULL, "unit_price" DECIMAL(14,2) NOT NULL, "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0, "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "net_amount" DECIMAL(14,2) NOT NULL, "tax_amount" DECIMAL(14,2) NOT NULL, "total_amount" DECIMAL(14,2) NOT NULL, CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quotes_company_id_code_key" ON "quotes"("company_id", "code");
CREATE INDEX "quotes_company_id_status_issue_date_idx" ON "quotes"("company_id", "status", "issue_date");
CREATE UNIQUE INDEX "quote_lines_quote_id_position_key" ON "quote_lines"("quote_id", "position");
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_organization_isolation" ON "quotes" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "quote_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_lines_organization_isolation" ON "quote_lines" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'quote.read', 'Read quotations'), (gen_random_uuid(), 'quote.create', 'Create quotations'), (gen_random_uuid(), 'quote.update', 'Update quotations'), (gen_random_uuid(), 'quote.change_status', 'Change quotation status')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions" ("role_id", "permission_id") SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p WHERE r."code" = 'organization.owner' AND p."code" IN ('quote.read', 'quote.create', 'quote.update', 'quote.change_status') ON CONFLICT DO NOTHING;
