CREATE TYPE "SifInvoiceType" AS ENUM ('F1', 'R1', 'R2', 'R3', 'R4', 'R5');

ALTER TABLE "invoices"
  ADD COLUMN "sif_invoice_type" "SifInvoiceType" NOT NULL DEFAULT 'F1';

UPDATE "invoices"
SET "sif_invoice_type" = 'R4'
WHERE "document_type" = 'CREDIT_NOTE';

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_sif_type_consistency_check" CHECK (
    ("document_type" = 'INVOICE' AND "sif_invoice_type" = 'F1')
    OR
    ("document_type" = 'CREDIT_NOTE' AND "sif_invoice_type" IN ('R1', 'R2', 'R3', 'R4', 'R5'))
  );

CREATE OR REPLACE FUNCTION validate_sif_record_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_position BIGINT;
  previous_hash CHAR(64);
  previous_generated_at TIMESTAMPTZ(6);
  invoice_issuer_tax_id VARCHAR(40);
  invoice_number VARCHAR(80);
  invoice_issue_date DATE;
  invoice_sif_type "SifInvoiceType";
  invoice_status "InvoiceStatus";
BEGIN
  SELECT i."issuer_tax_id", i."full_number", i."issue_date", i."sif_invoice_type", i."status"
    INTO invoice_issuer_tax_id, invoice_number, invoice_issue_date, invoice_sif_type, invoice_status
  FROM "invoices" i
  WHERE i."id" = NEW."invoice_id"
    AND i."organization_id" = NEW."organization_id"
    AND i."company_id" = NEW."company_id";

  IF invoice_status IS NULL OR invoice_status = 'DRAFT'
    OR invoice_issuer_tax_id IS DISTINCT FROM NEW."issuer_tax_id"
    OR invoice_number IS DISTINCT FROM NEW."invoice_number"
    OR invoice_issue_date IS DISTINCT FROM NEW."invoice_issue_date"
    OR invoice_sif_type::text IS DISTINCT FROM NEW."invoice_type" THEN
    RAISE EXCEPTION 'SIF registration must snapshot an issued invoice';
  END IF;

  IF NEW."chain_position" > 1 THEN
    SELECT r."chain_position", r."record_hash", r."generated_at"
      INTO previous_position, previous_hash, previous_generated_at
    FROM "sif_records" r
    WHERE r."id" = NEW."previous_record_id"
      AND r."organization_id" = NEW."organization_id"
      AND r."company_id" = NEW."company_id";
    IF previous_position IS NULL
      OR previous_position <> NEW."chain_position" - 1
      OR previous_hash IS DISTINCT FROM NEW."previous_record_hash"
      OR previous_generated_at > NEW."generated_at" THEN
      RAISE EXCEPTION 'invalid SIF record chain';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
