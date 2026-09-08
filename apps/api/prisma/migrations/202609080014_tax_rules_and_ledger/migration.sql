CREATE TYPE "TaxLedgerStatus" AS ENUM ('POSTED');
CREATE TYPE "TaxLedgerDirection" AS ENUM ('SALES', 'PURCHASES');
CREATE TYPE "TaxBookType" AS ENUM ('ISSUED_INVOICES', 'RECEIVED_INVOICES');

CREATE TABLE "tax_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "jurisdiction" VARCHAR(20) NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "tax_family" VARCHAR(30) NOT NULL,
  "operation_type" VARCHAR(50) NOT NULL,
  "rate" DECIMAL(9,6),
  "surcharge_rate" DECIMAL(9,6),
  "subject" BOOLEAN NOT NULL,
  "exempt" BOOLEAN NOT NULL DEFAULT false,
  "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
  "deduction_right" BOOLEAN NOT NULL DEFAULT true,
  "intra_eu" BOOLEAN NOT NULL DEFAULT false,
  "import_operation" BOOLEAN NOT NULL DEFAULT false,
  "export_operation" BOOLEAN NOT NULL DEFAULT false,
  "special_regime_code" VARCHAR(50),
  "legal_reference" TEXT NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tax_rules_dates_check" CHECK (
    "effective_to" IS NULL OR "effective_to" >= "effective_from"
  ),
  CONSTRAINT "tax_rules_rates_check" CHECK (
    ("rate" IS NULL OR "rate" BETWEEN 0 AND 100)
    AND ("surcharge_rate" IS NULL OR "surcharge_rate" BETWEEN 0 AND 100)
  ),
  CONSTRAINT "tax_rules_nature_check" CHECK (
    ("subject" AND (NOT "exempt" OR COALESCE("rate", 0) = 0))
    OR (NOT "subject" AND NOT "exempt" AND "rate" IS NULL)
  )
);

CREATE UNIQUE INDEX "tax_rules_code_effective_from_key"
  ON "tax_rules"("code", "effective_from");
CREATE INDEX "tax_rules_jurisdiction_effective_from_effective_to_idx"
  ON "tax_rules"("jurisdiction", "effective_from", "effective_to");

INSERT INTO "tax_rules" (
  "jurisdiction", "code", "tax_family", "operation_type", "rate",
  "subject", "exempt", "legal_reference", "effective_from"
) VALUES
  ('ES', 'ES_VAT_GENERAL_21', 'VAT', 'DOMESTIC_GENERAL', 21, true, false,
   'Ley 37/1992, art. 90; https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740', '2026-01-01'),
  ('ES', 'ES_VAT_REDUCED_10', 'VAT', 'DOMESTIC_REDUCED', 10, true, false,
   'Ley 37/1992, art. 91; https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740', '2026-01-01'),
  ('ES', 'ES_VAT_SUPER_REDUCED_4', 'VAT', 'DOMESTIC_SUPER_REDUCED', 4, true, false,
   'Ley 37/1992, art. 91; https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740', '2026-01-01'),
  ('ES', 'ES_VAT_ZERO_0', 'VAT', 'DOMESTIC_ZERO_RATED', 0, true, false,
   'Aplicación limitada a operaciones legalmente previstas; https://sede.agenciatributaria.gob.es/Sede/iva/calculo-iva-repercutido-clientes/tipos-impositivos-iva.html', '2026-01-01'),
  ('ES', 'ES_VAT_EXEMPT', 'VAT', 'DOMESTIC_EXEMPT', 0, true, true,
   'Ley 37/1992, arts. 20 y siguientes; https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740', '2026-01-01'),
  ('ES', 'ES_VAT_NOT_SUBJECT', 'VAT', 'DOMESTIC_NOT_SUBJECT', NULL, false, false,
   'Ley 37/1992, arts. 4 a 7; https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740', '2026-01-01');

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_id_invoice_tenant_key"
  UNIQUE ("id", "invoice_id", "organization_id", "company_id");

CREATE TABLE "invoice_tax_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "invoice_line_id" UUID NOT NULL,
  "tax_rule_id" UUID NOT NULL,
  "tax_code" VARCHAR(80) NOT NULL,
  "taxable_base" DECIMAL(14,2) NOT NULL,
  "tax_rate" DECIMAL(9,6),
  "tax_amount" DECIMAL(14,2) NOT NULL,
  "surcharge_rate" DECIMAL(9,6),
  "surcharge_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "subject" BOOLEAN NOT NULL,
  "exempt" BOOLEAN NOT NULL,
  "exemption_reason" VARCHAR(100),
  "reverse_charge" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_tax_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_tax_lines_amounts_check" CHECK (
    "taxable_base" >= 0 AND "tax_amount" >= 0 AND "surcharge_amount" >= 0
  ),
  CONSTRAINT "invoice_tax_lines_exemption_check" CHECK (
    ("exempt" AND length(btrim("exemption_reason")) > 0 AND "tax_amount" = 0)
    OR (NOT "exempt" AND "exemption_reason" IS NULL)
  )
);

CREATE UNIQUE INDEX "invoice_tax_lines_invoice_line_id_key"
  ON "invoice_tax_lines"("invoice_line_id");
CREATE UNIQUE INDEX "invoice_tax_lines_id_organization_id_company_id_key"
  ON "invoice_tax_lines"("id", "organization_id", "company_id");
CREATE INDEX "invoice_tax_lines_invoice_id_idx" ON "invoice_tax_lines"("invoice_id");

ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_invoice_tenant_fkey"
  FOREIGN KEY ("invoice_id", "organization_id", "company_id")
  REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_line_tenant_fkey"
  FOREIGN KEY ("invoice_line_id", "invoice_id", "organization_id", "company_id")
  REFERENCES "invoice_lines"("id", "invoice_id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "invoice_tax_lines" ADD CONSTRAINT "invoice_tax_lines_tax_rule_id_fkey"
  FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE RESTRICT;

INSERT INTO "invoice_tax_lines" (
  "organization_id", "company_id", "invoice_id", "invoice_line_id",
  "tax_rule_id", "tax_code", "taxable_base", "tax_rate", "tax_amount",
  "subject", "exempt", "reverse_charge"
)
SELECT
  l."organization_id", l."company_id", l."invoice_id", l."id",
  r."id", r."code", l."net_amount", r."rate", l."tax_amount",
  r."subject", r."exempt", r."reverse_charge"
FROM "invoice_lines" l
JOIN "invoices" i ON i."id" = l."invoice_id"
JOIN "tax_rules" r ON r."code" = CASE l."tax_rate"
  WHEN 21 THEN 'ES_VAT_GENERAL_21'
  WHEN 10 THEN 'ES_VAT_REDUCED_10'
  WHEN 4 THEN 'ES_VAT_SUPER_REDUCED_4'
END
WHERE i."issue_date" >= r."effective_from"
  AND l."tax_rate" IN (4, 10, 21);

CREATE TABLE "tax_ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "direction" "TaxLedgerDirection" NOT NULL,
  "book_type" "TaxBookType" NOT NULL,
  "issue_date" DATE NOT NULL,
  "operation_date" DATE NOT NULL,
  "tax_point_date" DATE NOT NULL,
  "counterparty_id" UUID NOT NULL,
  "counterparty_tax_id" VARCHAR(40),
  "counterparty_country" CHAR(2) NOT NULL DEFAULT 'ES',
  "document_number" VARCHAR(100) NOT NULL,
  "correction_of_id" UUID,
  "rectification_impact" "RectificationImpact",
  "status" "TaxLedgerStatus" NOT NULL DEFAULT 'POSTED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tax_ledger_entries_correction_check" CHECK (
    ("correction_of_id" IS NULL AND "rectification_impact" IS NULL)
    OR ("correction_of_id" IS NOT NULL AND "rectification_impact" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "tax_ledger_entries_invoice_id_key" ON "tax_ledger_entries"("invoice_id");
CREATE UNIQUE INDEX "tax_ledger_entries_id_organization_id_company_id_key"
  ON "tax_ledger_entries"("id", "organization_id", "company_id");
CREATE UNIQUE INDEX "tax_ledger_entries_invoice_id_organization_id_company_id_key"
  ON "tax_ledger_entries"("invoice_id", "organization_id", "company_id");
CREATE INDEX "tax_ledger_entries_company_id_tax_point_date_id_idx"
  ON "tax_ledger_entries"("company_id", "tax_point_date", "id");

ALTER TABLE "tax_ledger_entries" ADD CONSTRAINT "tax_ledger_entries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_entries" ADD CONSTRAINT "tax_ledger_entries_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_entries" ADD CONSTRAINT "tax_ledger_entries_invoice_tenant_fkey"
  FOREIGN KEY ("invoice_id", "organization_id", "company_id")
  REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "tax_ledger_entries" ADD CONSTRAINT "tax_ledger_entries_counterparty_tenant_fkey"
  FOREIGN KEY ("counterparty_id", "organization_id", "company_id")
  REFERENCES "contacts"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "tax_ledger_entries" ADD CONSTRAINT "tax_ledger_entries_correction_tenant_fkey"
  FOREIGN KEY ("correction_of_id", "organization_id", "company_id")
  REFERENCES "tax_ledger_entries"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE TABLE "tax_ledger_amounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "tax_ledger_entry_id" UUID NOT NULL,
  "invoice_tax_line_id" UUID NOT NULL,
  "tax_rule_id" UUID NOT NULL,
  "taxable_base" DECIMAL(14,2) NOT NULL,
  "rate" DECIMAL(9,6),
  "tax_amount" DECIMAL(14,2) NOT NULL,
  "surcharge_rate" DECIMAL(9,6),
  "surcharge_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_ledger_amounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_ledger_amounts_entry_tax_line_key"
  ON "tax_ledger_amounts"("tax_ledger_entry_id", "invoice_tax_line_id");
CREATE INDEX "tax_ledger_amounts_company_id_tax_rule_id_idx"
  ON "tax_ledger_amounts"("company_id", "tax_rule_id");

ALTER TABLE "tax_ledger_amounts" ADD CONSTRAINT "tax_ledger_amounts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_amounts" ADD CONSTRAINT "tax_ledger_amounts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_ledger_amounts" ADD CONSTRAINT "tax_ledger_amounts_entry_tenant_fkey"
  FOREIGN KEY ("tax_ledger_entry_id", "organization_id", "company_id")
  REFERENCES "tax_ledger_entries"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "tax_ledger_amounts" ADD CONSTRAINT "tax_ledger_amounts_invoice_tax_line_tenant_fkey"
  FOREIGN KEY ("invoice_tax_line_id", "organization_id", "company_id")
  REFERENCES "invoice_tax_lines"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "tax_ledger_amounts" ADD CONSTRAINT "tax_ledger_amounts_tax_rule_id_fkey"
  FOREIGN KEY ("tax_rule_id") REFERENCES "tax_rules"("id") ON DELETE RESTRICT;

INSERT INTO "tax_ledger_entries" (
  "organization_id", "company_id", "invoice_id", "direction", "book_type",
  "issue_date", "operation_date", "tax_point_date", "counterparty_id",
  "counterparty_tax_id", "counterparty_country", "document_number"
)
SELECT
  i."organization_id", i."company_id", i."id", 'SALES', 'ISSUED_INVOICES',
  i."issue_date", i."issue_date", i."issue_date", i."contact_id",
  i."customer_tax_id",
  CASE
    WHEN length(COALESCE(i."billing_address"->>'country', '')) = 2
      THEN upper(i."billing_address"->>'country')
    ELSE 'ES'
  END,
  i."full_number"
FROM "invoices" i
WHERE i."document_type" = 'INVOICE'
  AND i."status" <> 'DRAFT'
  AND i."full_number" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "invoice_lines" l WHERE l."invoice_id" = i."id")
  AND NOT EXISTS (
    SELECT 1 FROM "invoice_lines" l
    LEFT JOIN "invoice_tax_lines" t ON t."invoice_line_id" = l."id"
    WHERE l."invoice_id" = i."id" AND t."id" IS NULL
  );

INSERT INTO "tax_ledger_entries" (
  "organization_id", "company_id", "invoice_id", "direction", "book_type",
  "issue_date", "operation_date", "tax_point_date", "counterparty_id",
  "counterparty_tax_id", "counterparty_country", "document_number",
  "correction_of_id", "rectification_impact"
)
SELECT
  i."organization_id", i."company_id", i."id", 'SALES', 'ISSUED_INVOICES',
  i."issue_date", i."issue_date", i."issue_date", i."contact_id",
  i."customer_tax_id",
  CASE
    WHEN length(COALESCE(i."billing_address"->>'country', '')) = 2
      THEN upper(i."billing_address"->>'country')
    ELSE 'ES'
  END,
  i."full_number", original_entry."id", i."rectification_impact"
FROM "invoices" i
JOIN "tax_ledger_entries" original_entry
  ON original_entry."invoice_id" = i."original_invoice_id"
WHERE i."document_type" = 'CREDIT_NOTE'
  AND i."status" <> 'DRAFT'
  AND i."full_number" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "invoice_lines" l WHERE l."invoice_id" = i."id")
  AND NOT EXISTS (
    SELECT 1 FROM "invoice_lines" l
    LEFT JOIN "invoice_tax_lines" t ON t."invoice_line_id" = l."id"
    WHERE l."invoice_id" = i."id" AND t."id" IS NULL
  );

INSERT INTO "tax_ledger_amounts" (
  "organization_id", "company_id", "tax_ledger_entry_id", "invoice_tax_line_id",
  "tax_rule_id", "taxable_base", "rate", "tax_amount", "surcharge_rate",
  "surcharge_amount"
)
SELECT
  e."organization_id", e."company_id", e."id", t."id", t."tax_rule_id",
  CASE WHEN i."document_type" = 'CREDIT_NOTE' AND i."rectification_impact" = 'DECREASE'
    THEN -t."taxable_base" ELSE t."taxable_base" END,
  t."tax_rate",
  CASE WHEN i."document_type" = 'CREDIT_NOTE' AND i."rectification_impact" = 'DECREASE'
    THEN -t."tax_amount" ELSE t."tax_amount" END,
  t."surcharge_rate",
  CASE WHEN i."document_type" = 'CREDIT_NOTE' AND i."rectification_impact" = 'DECREASE'
    THEN -t."surcharge_amount" ELSE t."surcharge_amount" END
FROM "tax_ledger_entries" e
JOIN "invoices" i ON i."id" = e."invoice_id"
JOIN "invoice_tax_lines" t ON t."invoice_id" = i."id";

ALTER TABLE "invoice_tax_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_tax_lines_organization_isolation" ON "invoice_tax_lines"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "invoice_tax_lines" FORCE ROW LEVEL SECURITY;

ALTER TABLE "tax_ledger_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_ledger_entries_organization_isolation" ON "tax_ledger_entries"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "tax_ledger_entries" FORCE ROW LEVEL SECURITY;

ALTER TABLE "tax_ledger_amounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_ledger_amounts_organization_isolation" ON "tax_ledger_amounts"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "tax_ledger_amounts" FORCE ROW LEVEL SECURITY;

CREATE FUNCTION prevent_tax_rule_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'tax rules are immutable; create a new effective version';
END;
$$;
CREATE TRIGGER "tax_rules_immutable"
BEFORE UPDATE OR DELETE ON "tax_rules"
FOR EACH ROW EXECUTE FUNCTION prevent_tax_rule_mutation();

CREATE FUNCTION enforce_invoice_tax_line_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_status "InvoiceStatus";
  target_invoice_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN target_invoice_id := OLD."invoice_id";
  ELSE target_invoice_id := NEW."invoice_id";
  END IF;
  SELECT "status" INTO invoice_status FROM "invoices" WHERE "id" = target_invoice_id;
  IF invoice_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'issued invoice tax lines are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "invoice_tax_lines_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "invoice_tax_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_invoice_tax_line_immutability();

CREATE FUNCTION prevent_tax_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'tax ledger is append-only';
END;
$$;
CREATE TRIGGER "tax_ledger_entries_append_only"
BEFORE UPDATE OR DELETE ON "tax_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_tax_ledger_mutation();
CREATE TRIGGER "tax_ledger_amounts_append_only"
BEFORE UPDATE OR DELETE ON "tax_ledger_amounts"
FOR EACH ROW EXECUTE FUNCTION prevent_tax_ledger_mutation();

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'tax_rule.read', 'Read versioned tax rules'),
  (gen_random_uuid(), 'tax_ledger.read', 'Read tax ledger')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner'
  AND p."code" IN ('tax_rule.read', 'tax_ledger.read')
ON CONFLICT DO NOTHING;
