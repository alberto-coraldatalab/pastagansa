CREATE TYPE "PurchaseOcrStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'REVIEW_REQUIRED', 'REVIEWED', 'FAILED'
);

CREATE TABLE "purchase_invoice_ocr_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "attachment_id" UUID NOT NULL,
  "status" "PurchaseOcrStatus" NOT NULL DEFAULT 'PENDING',
  "engine" VARCHAR(80) NOT NULL DEFAULT 'tesseract.js',
  "engine_version" VARCHAR(40) NOT NULL DEFAULT '7.0.0',
  "raw_text" TEXT,
  "extracted_fields" JSONB,
  "overall_confidence" DECIMAL(5,2),
  "review_fields" JSONB,
  "requested_by_id" UUID NOT NULL,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoice_ocr_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_ocr_attempts_check" CHECK ("attempts" BETWEEN 0 AND 3),
  CONSTRAINT "purchase_ocr_confidence_check" CHECK (
    "overall_confidence" IS NULL OR "overall_confidence" BETWEEN 0 AND 100
  ),
  CONSTRAINT "purchase_ocr_state_check" CHECK (
    ("status" = 'PENDING' AND "raw_text" IS NULL AND "extracted_fields" IS NULL
      AND "review_fields" IS NULL AND "reviewed_by_id" IS NULL
      AND "reviewed_at" IS NULL AND "locked_at" IS NULL)
    OR
    ("status" = 'PROCESSING' AND "attempts" > 0 AND "locked_at" IS NOT NULL
      AND "review_fields" IS NULL AND "reviewed_by_id" IS NULL AND "reviewed_at" IS NULL)
    OR
    ("status" = 'REVIEW_REQUIRED' AND "raw_text" IS NOT NULL
      AND "extracted_fields" IS NOT NULL AND "overall_confidence" IS NOT NULL
      AND "review_fields" IS NULL AND "reviewed_by_id" IS NULL
      AND "reviewed_at" IS NULL AND "locked_at" IS NULL)
    OR
    ("status" = 'REVIEWED' AND "raw_text" IS NOT NULL
      AND "extracted_fields" IS NOT NULL AND "overall_confidence" IS NOT NULL
      AND "review_fields" IS NOT NULL AND "reviewed_by_id" IS NOT NULL
      AND "reviewed_at" IS NOT NULL AND "locked_at" IS NULL)
    OR
    ("status" = 'FAILED' AND "last_error" IS NOT NULL AND "locked_at" IS NULL
      AND "review_fields" IS NULL AND "reviewed_by_id" IS NULL AND "reviewed_at" IS NULL)
  )
);

CREATE UNIQUE INDEX "purchase_ocr_attachment_key"
  ON "purchase_invoice_ocr_jobs"("attachment_id");
CREATE UNIQUE INDEX "purchase_ocr_id_tenant_key"
  ON "purchase_invoice_ocr_jobs"("id", "organization_id", "company_id");
CREATE UNIQUE INDEX "purchase_ocr_attachment_tenant_key"
  ON "purchase_invoice_ocr_jobs"("attachment_id", "organization_id", "company_id");
CREATE INDEX "purchase_ocr_invoice_created_idx"
  ON "purchase_invoice_ocr_jobs"("purchase_invoice_id", "created_at");
CREATE INDEX "purchase_ocr_status_available_idx"
  ON "purchase_invoice_ocr_jobs"("status", "available_at");

ALTER TABLE "purchase_invoice_ocr_jobs" ADD CONSTRAINT "purchase_ocr_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_ocr_jobs" ADD CONSTRAINT "purchase_ocr_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_ocr_jobs" ADD CONSTRAINT "purchase_ocr_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "purchase_invoice_ocr_jobs" ADD CONSTRAINT "purchase_ocr_attachment_tenant_fkey"
  FOREIGN KEY ("attachment_id", "organization_id", "company_id")
  REFERENCES "purchase_invoice_attachments"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "purchase_invoice_ocr_jobs" ADD CONSTRAINT "purchase_ocr_requested_by_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_ocr_jobs" ADD CONSTRAINT "purchase_ocr_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "purchase_invoice_ocr_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_ocr_organization_isolation" ON "purchase_invoice_ocr_jobs"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_invoice_ocr_jobs" FORCE ROW LEVEL SECURITY;

CREATE FUNCTION enforce_purchase_ocr_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_status "PurchaseInvoiceStatus";
  attachment_type VARCHAR(100);
  attachment_invoice UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO invoice_status FROM "purchase_invoices"
    WHERE "id" = OLD."purchase_invoice_id";
    IF invoice_status IS NOT NULL AND invoice_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'submitted purchase invoice OCR records are immutable';
    END IF;
    RETURN OLD;
  END IF;

  SELECT "status" INTO invoice_status FROM "purchase_invoices"
  WHERE "id" = NEW."purchase_invoice_id";
  IF TG_OP = 'INSERT' THEN
    SELECT "media_type", "purchase_invoice_id"
      INTO attachment_type, attachment_invoice
    FROM "purchase_invoice_attachments" WHERE "id" = NEW."attachment_id";
    IF invoice_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'OCR can only be requested for draft purchase invoices';
    END IF;
    IF attachment_invoice IS DISTINCT FROM NEW."purchase_invoice_id"
       OR attachment_type NOT IN ('image/png', 'image/jpeg') THEN
      RAISE EXCEPTION 'OCR requires a PNG or JPEG attachment from the same invoice';
    END IF;
  ELSIF OLD."status" = 'REVIEWED' THEN
    RAISE EXCEPTION 'reviewed OCR records are immutable';
  ELSIF NEW."status" = 'REVIEWED' AND invoice_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'OCR can only be reviewed for draft purchase invoices';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "purchase_ocr_integrity"
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_invoice_ocr_jobs"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_ocr_integrity();

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'purchase_invoice.ocr', 'Request and review purchase invoice OCR')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner' AND p."code" = 'purchase_invoice.ocr'
ON CONFLICT DO NOTHING;
