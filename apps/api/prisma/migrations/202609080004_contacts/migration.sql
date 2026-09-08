CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "legal_name" VARCHAR(240) NOT NULL,
  "trade_name" VARCHAR(240),
  "tax_id" VARCHAR(40),
  "email" VARCHAR(320),
  "phone" VARCHAR(40),
  "is_customer" BOOLEAN NOT NULL DEFAULT false,
  "is_supplier" BOOLEAN NOT NULL DEFAULT false,
  "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contacts_company_id_tax_id_key" ON "contacts"("company_id", "tax_id");
CREATE INDEX "contacts_company_id_status_legal_name_idx" ON "contacts"("company_id", "status", "legal_name");
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_organization_isolation" ON "contacts" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'contact.read', 'Read contacts'),
  (gen_random_uuid(), 'contact.create', 'Create contacts'),
  (gen_random_uuid(), 'contact.update', 'Update contacts'),
  (gen_random_uuid(), 'contact.archive', 'Archive contacts')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner' AND p."code" IN ('contact.read', 'contact.create', 'contact.update', 'contact.archive')
ON CONFLICT DO NOTHING;
