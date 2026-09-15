ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'QUOTE';

ALTER TABLE "quotes"
  ADD COLUMN "sequence_id" UUID,
  ADD COLUMN "series" VARCHAR(30),
  ADD COLUMN "number" BIGINT;

CREATE UNIQUE INDEX "quotes_company_id_series_number_key"
  ON "quotes"("company_id", "series", "number");

ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_sequence_id_organization_id_company_id_fkey"
  FOREIGN KEY ("sequence_id", "organization_id", "company_id")
  REFERENCES "document_sequences"("id", "organization_id", "company_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
