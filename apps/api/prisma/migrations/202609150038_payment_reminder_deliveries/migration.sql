CREATE TYPE "DeliveryPurpose" AS ENUM ('DOCUMENT_DELIVERY', 'PAYMENT_REMINDER');

ALTER TABLE "document_deliveries"
  ADD COLUMN "purpose" "DeliveryPurpose" NOT NULL DEFAULT 'DOCUMENT_DELIVERY';

CREATE INDEX "document_deliveries_company_purpose_created_at_idx"
  ON "document_deliveries"("company_id", "purpose", "created_at");
