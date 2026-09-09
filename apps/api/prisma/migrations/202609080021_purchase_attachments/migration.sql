CREATE TABLE "purchase_invoice_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "original_name" VARCHAR(240) NOT NULL,
  "media_type" VARCHAR(100) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "content" BYTEA NOT NULL,
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoice_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_attachments_size_check" CHECK (
    "size_bytes" > 0 AND "size_bytes" <= 10485760 AND octet_length("content") = "size_bytes"
  ),
  CONSTRAINT "purchase_attachments_media_type_check" CHECK (
    "media_type" IN ('application/pdf', 'image/png', 'image/jpeg')
  ),
  CONSTRAINT "purchase_attachments_sha256_check" CHECK (
    "sha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "purchase_attachments_invoice_sha256_key"
  ON "purchase_invoice_attachments"("purchase_invoice_id", "sha256");
CREATE UNIQUE INDEX "purchase_attachments_id_tenant_key"
  ON "purchase_invoice_attachments"("id", "organization_id", "company_id");
CREATE INDEX "purchase_attachments_invoice_created_idx"
  ON "purchase_invoice_attachments"("purchase_invoice_id", "created_at");

ALTER TABLE "purchase_invoice_attachments" ADD CONSTRAINT "purchase_attachments_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_attachments" ADD CONSTRAINT "purchase_attachments_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_attachments" ADD CONSTRAINT "purchase_attachments_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "purchase_invoice_attachments" ADD CONSTRAINT "purchase_attachments_created_by_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "purchase_invoice_attachments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_attachments_organization_isolation" ON "purchase_invoice_attachments"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_invoice_attachments" FORCE ROW LEVEL SECURITY;

CREATE FUNCTION enforce_purchase_attachment_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_status "PurchaseInvoiceStatus";
  target_invoice_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'purchase invoice attachments are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN target_invoice_id := OLD."purchase_invoice_id";
  ELSE target_invoice_id := NEW."purchase_invoice_id";
  END IF;

  SELECT "status" INTO invoice_status
  FROM "purchase_invoices" WHERE "id" = target_invoice_id;

  IF invoice_status IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'purchase invoice not found';
  END IF;
  IF invoice_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'approved purchase invoice attachments are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "purchase_attachments_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_invoice_attachments"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_attachment_immutability();
