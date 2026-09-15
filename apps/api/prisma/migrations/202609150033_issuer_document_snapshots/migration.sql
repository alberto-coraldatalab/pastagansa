ALTER TABLE "invoices"
  ADD COLUMN "issuer_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "issuer_snapshot_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN "issuer_logo_media_type" varchar(100),
  ADD COLUMN "issuer_logo_sha256" char(64),
  ADD COLUMN "issuer_logo_content" bytea,
  ADD CONSTRAINT "invoices_issuer_snapshot_version_check" CHECK ("issuer_snapshot_version" >= 1),
  ADD CONSTRAINT "invoices_issuer_logo_fields_check" CHECK (
    ("issuer_logo_content" IS NULL AND "issuer_logo_media_type" IS NULL AND "issuer_logo_sha256" IS NULL)
    OR ("issuer_logo_content" IS NOT NULL AND "issuer_logo_media_type" IN ('image/png', 'image/jpeg') AND "issuer_logo_sha256" ~ '^[0-9a-f]{64}$')
  );

ALTER TABLE "quotes"
  ADD COLUMN "issuer_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "issuer_snapshot_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN "issuer_logo_media_type" varchar(100),
  ADD COLUMN "issuer_logo_sha256" char(64),
  ADD COLUMN "issuer_logo_content" bytea,
  ADD CONSTRAINT "quotes_issuer_snapshot_version_check" CHECK ("issuer_snapshot_version" >= 1),
  ADD CONSTRAINT "quotes_issuer_logo_fields_check" CHECK (
    ("issuer_logo_content" IS NULL AND "issuer_logo_media_type" IS NULL AND "issuer_logo_sha256" IS NULL)
    OR ("issuer_logo_content" IS NOT NULL AND "issuer_logo_media_type" IN ('image/png', 'image/jpeg') AND "issuer_logo_sha256" ~ '^[0-9a-f]{64}$')
  );

ALTER TABLE "invoices" DISABLE TRIGGER "issued_invoice_immutability";
ALTER TABLE "invoices" DISABLE TRIGGER "rectification_original_integrity";

UPDATE "invoices"
SET "issuer_snapshot" = jsonb_build_object(
  'version', 1,
  'source', 'legacy_backfill',
  'legalName', "issuer_legal_name",
  'taxId', "issuer_tax_id"
);

ALTER TABLE "invoices" ENABLE TRIGGER "issued_invoice_immutability";
ALTER TABLE "invoices" ENABLE TRIGGER "rectification_original_integrity";

UPDATE "quotes"
SET "issuer_snapshot" = jsonb_build_object(
  'version', 1,
  'source', 'legacy_backfill'
);
