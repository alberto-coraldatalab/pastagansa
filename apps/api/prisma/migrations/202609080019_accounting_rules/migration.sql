CREATE TABLE "accounting_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "source_type" "JournalSourceType" NOT NULL,
  "accounting_role" "AccountingRole" NOT NULL,
  "account_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_rules_company_source_role_key"
  ON "accounting_rules"("company_id", "source_type", "accounting_role");
CREATE UNIQUE INDEX "accounting_rules_id_tenant_key"
  ON "accounting_rules"("id", "organization_id", "company_id");
CREATE INDEX "accounting_rules_company_source_idx"
  ON "accounting_rules"("company_id", "source_type");

ALTER TABLE "accounting_rules" ADD CONSTRAINT "accounting_rules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "accounting_rules" ADD CONSTRAINT "accounting_rules_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "accounting_rules" ADD CONSTRAINT "accounting_rules_account_tenant_fkey"
  FOREIGN KEY ("account_id", "organization_id", "company_id")
  REFERENCES "accounts"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE FUNCTION validate_accounting_rule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actual_class "AccountClass";
  account_active BOOLEAN;
  expected_class "AccountClass";
BEGIN
  IF NOT (
    (NEW."source_type" = 'SALES_INVOICE' AND NEW."accounting_role" IN ('CUSTOMER_RECEIVABLE', 'SALES_REVENUE', 'OUTPUT_VAT')) OR
    (NEW."source_type" = 'PURCHASE_INVOICE' AND NEW."accounting_role" IN ('PURCHASE_EXPENSE', 'INPUT_VAT', 'SUPPLIER_PAYABLE')) OR
    (NEW."source_type" = 'PAYMENT' AND NEW."accounting_role" IN ('BANK', 'CUSTOMER_RECEIVABLE')) OR
    (NEW."source_type" = 'SUPPLIER_PAYMENT' AND NEW."accounting_role" IN ('SUPPLIER_PAYABLE', 'BANK'))
  ) THEN
    RAISE EXCEPTION 'accounting role is not valid for source type';
  END IF;

  expected_class := CASE NEW."accounting_role"
    WHEN 'CUSTOMER_RECEIVABLE' THEN 'ASSET'::"AccountClass"
    WHEN 'SUPPLIER_PAYABLE' THEN 'LIABILITY'::"AccountClass"
    WHEN 'SALES_REVENUE' THEN 'INCOME'::"AccountClass"
    WHEN 'PURCHASE_EXPENSE' THEN 'EXPENSE'::"AccountClass"
    WHEN 'OUTPUT_VAT' THEN 'LIABILITY'::"AccountClass"
    WHEN 'INPUT_VAT' THEN 'ASSET'::"AccountClass"
    WHEN 'BANK' THEN 'ASSET'::"AccountClass"
  END;

  SELECT "account_class", "active" INTO actual_class, account_active
  FROM "accounts"
  WHERE "id" = NEW."account_id"
    AND "organization_id" = NEW."organization_id"
    AND "company_id" = NEW."company_id";

  IF NOT FOUND OR account_active IS NOT TRUE OR actual_class <> expected_class THEN
    RAISE EXCEPTION 'accounting rule requires an active account of the expected class';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "accounting_rules_validate"
BEFORE INSERT OR UPDATE ON "accounting_rules"
FOR EACH ROW EXECUTE FUNCTION validate_accounting_rule();

ALTER TABLE "accounting_rules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounting_rules_organization_isolation" ON "accounting_rules"
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "accounting_rules" FORCE ROW LEVEL SECURITY;

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'accounting_rule.read', 'Read accounting rules'),
  (gen_random_uuid(), 'accounting_rule.manage', 'Manage accounting rules')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner' AND p."code" LIKE 'accounting_rule.%'
ON CONFLICT DO NOTHING;
