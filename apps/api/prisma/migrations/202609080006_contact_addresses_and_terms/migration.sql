CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'DIRECT_DEBIT', 'CASH', 'CARD', 'OTHER');
CREATE TYPE "AddressType" AS ENUM ('BILLING', 'SHIPPING', 'OTHER');

ALTER TABLE "contacts" ADD COLUMN "payment_terms_days" INTEGER;
ALTER TABLE "contacts" ADD COLUMN "payment_method" "PaymentMethod";
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_payment_terms_days_check" CHECK ("payment_terms_days" IS NULL OR "payment_terms_days" BETWEEN 0 AND 365);

CREATE TABLE "contact_addresses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "type" "AddressType" NOT NULL DEFAULT 'BILLING',
  "label" VARCHAR(120),
  "line1" VARCHAR(240) NOT NULL,
  "line2" VARCHAR(240),
  "postal_code" VARCHAR(20) NOT NULL,
  "city" VARCHAR(120) NOT NULL,
  "province" VARCHAR(120),
  "country" CHAR(2) NOT NULL DEFAULT 'ES',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMPTZ(6),
  CONSTRAINT "contact_addresses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_addresses_company_id_contact_id_archived_at_idx" ON "contact_addresses"("company_id", "contact_id", "archived_at");
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contact_addresses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_addresses_organization_isolation" ON "contact_addresses" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
