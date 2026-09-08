CREATE TYPE "RectificationKind" AS ENUM ('TOTAL', 'PARTIAL', 'DIFFERENCE');
CREATE TYPE "RectificationImpact" AS ENUM ('DECREASE', 'INCREASE');

ALTER TABLE "invoices"
  ADD COLUMN "original_invoice_id" UUID,
  ADD COLUMN "document_type" "DocumentType" NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN "rectification_kind" "RectificationKind",
  ADD COLUMN "rectification_impact" "RectificationImpact",
  ADD COLUMN "rectification_reason" VARCHAR(1000);

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_rectification_consistency_check" CHECK (
    (
      "document_type" = 'INVOICE'
      AND "original_invoice_id" IS NULL
      AND "rectification_kind" IS NULL
      AND "rectification_impact" IS NULL
      AND "rectification_reason" IS NULL
    )
    OR
    (
      "document_type" = 'CREDIT_NOTE'
      AND "original_invoice_id" IS NOT NULL
      AND "original_invoice_id" <> "id"
      AND "rectification_kind" IS NOT NULL
      AND "rectification_impact" IS NOT NULL
      AND length(btrim("rectification_reason")) >= 5
    )
  ),
  ADD CONSTRAINT "invoices_original_invoice_tenant_fkey"
    FOREIGN KEY ("original_invoice_id", "organization_id", "company_id")
    REFERENCES "invoices"("id", "organization_id", "company_id")
    ON DELETE RESTRICT;

CREATE INDEX "invoices_original_invoice_id_created_at_idx"
  ON "invoices"("original_invoice_id", "created_at");

CREATE UNIQUE INDEX "invoices_single_total_rectification_key"
  ON "invoices"("company_id", "original_invoice_id")
  WHERE "rectification_kind" = 'TOTAL';

CREATE FUNCTION enforce_rectification_original() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  original_type "DocumentType";
  original_status "InvoiceStatus";
BEGIN
  IF NEW."document_type" = 'CREDIT_NOTE' THEN
    SELECT "document_type", "status"
      INTO original_type, original_status
    FROM "invoices"
    WHERE "id" = NEW."original_invoice_id"
      AND "organization_id" = NEW."organization_id"
      AND "company_id" = NEW."company_id";

    IF original_type IS DISTINCT FROM 'INVOICE'
       OR original_status IN ('DRAFT', 'RECTIFIED', 'CANCELLED') THEN
      RAISE EXCEPTION 'rectifications require an issued standard invoice';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "rectification_original_integrity"
BEFORE INSERT OR UPDATE ON "invoices"
FOR EACH ROW EXECUTE FUNCTION enforce_rectification_original();
