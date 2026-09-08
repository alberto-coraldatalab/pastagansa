ALTER TABLE "sessions" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "quotes" ADD COLUMN "customer_legal_name" VARCHAR(240);
ALTER TABLE "quotes" ADD COLUMN "customer_tax_id" VARCHAR(40);
ALTER TABLE "quotes" ADD COLUMN "billing_address" JSONB;
UPDATE "quotes" q SET "customer_legal_name" = c."legal_name", "customer_tax_id" = c."tax_id" FROM "contacts" c WHERE c."id" = q."contact_id";
ALTER TABLE "quotes" ALTER COLUMN "customer_legal_name" SET NOT NULL;

CREATE UNIQUE INDEX "contact_addresses_one_default_per_type" ON "contact_addresses"("contact_id", "type") WHERE "is_default" AND "archived_at" IS NULL;
CREATE UNIQUE INDEX "memberships_org_company_user_role_nulls_not_distinct" ON "memberships"("organization_id", "company_id", "user_id", "role_id") NULLS NOT DISTINCT;

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_id_org_company_key" UNIQUE ("id", "organization_id", "company_id");
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_id_org_company_key" UNIQUE ("id", "organization_id", "company_id");
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_id_org_company_key" UNIQUE ("id", "organization_id", "company_id");
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_tenant_fkey" FOREIGN KEY ("contact_id", "organization_id", "company_id") REFERENCES "contacts"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_contact_tenant_fkey" FOREIGN KEY ("contact_id", "organization_id", "company_id") REFERENCES "contacts"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_tenant_fkey" FOREIGN KEY ("quote_id", "organization_id", "company_id") REFERENCES "quotes"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_catalog_tenant_fkey" FOREIGN KEY ("catalog_item_id", "organization_id", "company_id") REFERENCES "catalog_items"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;
ALTER TABLE "catalog_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "contact_addresses" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quotes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_lines" FORCE ROW LEVEL SECURITY;

CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;
CREATE TRIGGER "audit_events_append_only" BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
