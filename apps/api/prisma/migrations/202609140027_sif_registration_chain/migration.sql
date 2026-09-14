CREATE TYPE "SifRecordType" AS ENUM ('REGISTRATION', 'CANCELLATION');

CREATE TABLE "sif_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "record_type" "SifRecordType" NOT NULL,
  "chain_position" BIGINT NOT NULL,
  "issuer_tax_id" VARCHAR(40) NOT NULL,
  "invoice_number" VARCHAR(80) NOT NULL,
  "invoice_issue_date" DATE NOT NULL,
  "invoice_type" VARCHAR(2) NOT NULL,
  "tax_total" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "generated_at" TIMESTAMPTZ(6) NOT NULL,
  "previous_record_id" UUID,
  "previous_record_hash" CHAR(64),
  "record_hash" CHAR(64) NOT NULL,
  "hash_algorithm" VARCHAR(20) NOT NULL DEFAULT 'SHA-256',
  "specification_version" VARCHAR(40) NOT NULL DEFAULT 'AEAT-HASH-0.1.2',
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sif_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sif_records_chain_position_check" CHECK ("chain_position" >= 1),
  CONSTRAINT "sif_records_hash_check" CHECK ("record_hash" ~ '^[0-9A-F]{64}$'),
  CONSTRAINT "sif_records_previous_hash_check" CHECK (
    "previous_record_hash" IS NULL OR "previous_record_hash" ~ '^[0-9A-F]{64}$'
  ),
  CONSTRAINT "sif_records_first_record_check" CHECK (
    ("chain_position" = 1 AND "previous_record_id" IS NULL AND "previous_record_hash" IS NULL)
    OR
    ("chain_position" > 1 AND "previous_record_id" IS NOT NULL AND "previous_record_hash" IS NOT NULL)
  ),
  CONSTRAINT "sif_records_hash_algorithm_check" CHECK ("hash_algorithm" = 'SHA-256')
);

CREATE UNIQUE INDEX "sif_records_company_invoice_type_key"
  ON "sif_records"("company_id", "invoice_id", "record_type");
CREATE UNIQUE INDEX "sif_records_company_chain_position_key"
  ON "sif_records"("company_id", "chain_position");
CREATE UNIQUE INDEX "sif_records_previous_record_id_key"
  ON "sif_records"("previous_record_id");
CREATE UNIQUE INDEX "sif_records_id_tenant_key"
  ON "sif_records"("id", "organization_id", "company_id");
CREATE INDEX "sif_records_company_generated_id_idx"
  ON "sif_records"("company_id", "generated_at", "id");

ALTER TABLE "sif_records" ADD CONSTRAINT "sif_records_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "sif_records" ADD CONSTRAINT "sif_records_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "sif_records" ADD CONSTRAINT "sif_records_invoice_tenant_fkey"
  FOREIGN KEY ("invoice_id", "organization_id", "company_id")
  REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "sif_records" ADD CONSTRAINT "sif_records_previous_tenant_fkey"
  FOREIGN KEY ("previous_record_id", "organization_id", "company_id")
  REFERENCES "sif_records"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE FUNCTION validate_sif_record_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_position BIGINT;
  previous_hash CHAR(64);
  previous_generated_at TIMESTAMPTZ(6);
  invoice_issuer_tax_id VARCHAR(40);
  invoice_number VARCHAR(80);
  invoice_issue_date DATE;
  invoice_status "InvoiceStatus";
BEGIN
  SELECT i."issuer_tax_id", i."full_number", i."issue_date", i."status"
    INTO invoice_issuer_tax_id, invoice_number, invoice_issue_date, invoice_status
  FROM "invoices" i
  WHERE i."id" = NEW."invoice_id"
    AND i."organization_id" = NEW."organization_id"
    AND i."company_id" = NEW."company_id";

  IF invoice_status IS NULL OR invoice_status = 'DRAFT'
    OR invoice_issuer_tax_id IS DISTINCT FROM NEW."issuer_tax_id"
    OR invoice_number IS DISTINCT FROM NEW."invoice_number"
    OR invoice_issue_date IS DISTINCT FROM NEW."invoice_issue_date" THEN
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

CREATE TRIGGER "sif_records_validate_chain"
BEFORE INSERT ON "sif_records"
FOR EACH ROW EXECUTE FUNCTION validate_sif_record_chain();

CREATE FUNCTION prevent_sif_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SIF records are append-only';
END;
$$;

CREATE TRIGGER "sif_records_immutable"
BEFORE UPDATE OR DELETE ON "sif_records"
FOR EACH ROW EXECUTE FUNCTION prevent_sif_record_mutation();

ALTER TABLE "sif_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sif_records_organization_isolation" ON "sif_records"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "sif_records" FORCE ROW LEVEL SECURITY;

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'sif_record.read', 'Read SIF records')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner' AND p."code" = 'sif_record.read'
ON CONFLICT DO NOTHING;
