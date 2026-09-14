ALTER TABLE "quotes" ADD COLUMN "converted_invoice_id" UUID;

CREATE UNIQUE INDEX "quotes_converted_invoice_id_organization_id_company_id_key"
  ON "quotes"("converted_invoice_id", "organization_id", "company_id");

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_invoice_tenant_fkey"
  FOREIGN KEY ("converted_invoice_id", "organization_id", "company_id")
  REFERENCES "invoices"("id", "organization_id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
