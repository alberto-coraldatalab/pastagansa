ALTER TABLE "invoice_email_deliveries" RENAME TO "document_deliveries";

CREATE TYPE "DeliveryDocumentType" AS ENUM ('INVOICE', 'QUOTE');

ALTER TABLE "document_deliveries"
  ADD COLUMN "document_type" "DeliveryDocumentType",
  ADD COLUMN "quote_id" UUID,
  ADD COLUMN "body_template" VARCHAR(2000),
  ADD COLUMN "template_parameters" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "template_version" VARCHAR(40) NOT NULL DEFAULT 'v1',
  ADD COLUMN "provider" VARCHAR(100),
  ADD COLUMN "provider_message_id" VARCHAR(500);

UPDATE "document_deliveries" SET "document_type" = 'INVOICE';
ALTER TABLE "document_deliveries" ALTER COLUMN "document_type" SET NOT NULL;
ALTER TABLE "document_deliveries" ALTER COLUMN "invoice_id" DROP NOT NULL;

ALTER TABLE "document_deliveries"
  ADD CONSTRAINT "document_deliveries_quote_id_organization_id_company_id_fkey"
  FOREIGN KEY ("quote_id", "organization_id", "company_id")
  REFERENCES "quotes"("id", "organization_id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "document_deliveries_document_target_check"
  CHECK (
    ("document_type" = 'INVOICE' AND "invoice_id" IS NOT NULL AND "quote_id" IS NULL)
    OR ("document_type" = 'QUOTE' AND "quote_id" IS NOT NULL AND "invoice_id" IS NULL)
  );

CREATE INDEX "document_deliveries_quote_id_created_at_idx"
  ON "document_deliveries"("quote_id", "created_at");

ALTER TABLE "company_document_profiles"
  ADD COLUMN "invoice_email_subject_template" VARCHAR(300),
  ADD COLUMN "quote_email_subject_template" VARCHAR(300),
  ADD COLUMN "email_body_template" VARCHAR(2000);

ALTER TABLE "quotes" ADD COLUMN "customer_email" VARCHAR(320);
UPDATE "quotes" q
SET "customer_email" = c."email"
FROM "contacts" c
WHERE q."contact_id" = c."id"
  AND q."organization_id" = c."organization_id"
  AND q."company_id" = c."company_id";

INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'document.send', 'Send documents by email')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT DISTINCT rp."role_id", document_send."id"
FROM "role_permissions" rp
JOIN "permissions" legacy ON legacy."id" = rp."permission_id"
JOIN "permissions" document_send ON document_send."code" = 'document.send'
WHERE legacy."code" IN ('invoice.send', 'quote.change_status')
ON CONFLICT DO NOTHING;
