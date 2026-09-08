CREATE TYPE "CatalogItemType" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "CatalogItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "catalog_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "type" "CatalogItemType" NOT NULL,
  "sku" VARCHAR(80),
  "name" VARCHAR(240) NOT NULL,
  "description" TEXT,
  "unit" VARCHAR(30) NOT NULL DEFAULT 'unit',
  "sales_price" DECIMAL(14,2),
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "suggested_tax_code" VARCHAR(80),
  "revenue_account_code" VARCHAR(20),
  "expense_account_code" VARCHAR(20),
  "track_inventory" BOOLEAN NOT NULL DEFAULT false,
  "status" "CatalogItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_items_company_id_sku_key" ON "catalog_items"("company_id", "sku");
CREATE INDEX "catalog_items_company_id_status_name_idx" ON "catalog_items"("company_id", "status", "name");
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "catalog_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_items_organization_isolation" ON "catalog_items" USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'catalog.read', 'Read catalog'),
  (gen_random_uuid(), 'catalog.create', 'Create catalog items'),
  (gen_random_uuid(), 'catalog.update', 'Update catalog items'),
  (gen_random_uuid(), 'catalog.archive', 'Archive catalog items')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner' AND p."code" IN ('catalog.read', 'catalog.create', 'catalog.update', 'catalog.archive')
ON CONFLICT DO NOTHING;
