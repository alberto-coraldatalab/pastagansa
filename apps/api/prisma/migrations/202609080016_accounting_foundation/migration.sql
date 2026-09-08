CREATE TYPE "AccountClass" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
CREATE TYPE "AccountingRole" AS ENUM (
  'CUSTOMER_RECEIVABLE', 'SUPPLIER_PAYABLE', 'SALES_REVENUE',
  'PURCHASE_EXPENSE', 'OUTPUT_VAT', 'INPUT_VAT', 'BANK'
);
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'LOCKED');
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED');
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'SALES_INVOICE', 'PURCHASE_INVOICE', 'PAYMENT');

CREATE TABLE "accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "name" VARCHAR(240) NOT NULL,
  "account_class" "AccountClass" NOT NULL,
  "system_role" "AccountingRole",
  "parent_id" UUID,
  "is_reconcilable" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_company_code_key" ON "accounts"("company_id", "code");
CREATE UNIQUE INDEX "accounts_company_role_key" ON "accounts"("company_id", "system_role");
CREATE UNIQUE INDEX "accounts_id_tenant_key" ON "accounts"("id", "organization_id", "company_id");
CREATE INDEX "accounts_company_class_active_idx" ON "accounts"("company_id", "account_class", "active");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_tenant_fkey"
  FOREIGN KEY ("parent_id", "organization_id", "company_id")
  REFERENCES "accounts"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE TABLE "fiscal_years" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
  "next_entry_number" BIGINT NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fiscal_years_dates_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "fiscal_years_next_entry_check" CHECK ("next_entry_number" > 0)
);
CREATE UNIQUE INDEX "fiscal_years_company_code_key" ON "fiscal_years"("company_id", "code");
CREATE UNIQUE INDEX "fiscal_years_id_tenant_key" ON "fiscal_years"("id", "organization_id", "company_id");
CREATE INDEX "fiscal_years_company_dates_idx" ON "fiscal_years"("company_id", "start_date", "end_date");
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;

CREATE TABLE "accounting_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "fiscal_year_id" UUID NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "locked_at" TIMESTAMPTZ(6),
  "locked_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_periods_dates_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "accounting_periods_lock_check" CHECK (
    ("status" = 'OPEN' AND "locked_at" IS NULL AND "locked_by_id" IS NULL)
    OR ("status" = 'LOCKED' AND "locked_at" IS NOT NULL AND "locked_by_id" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "accounting_periods_year_code_key" ON "accounting_periods"("fiscal_year_id", "code");
CREATE UNIQUE INDEX "accounting_periods_id_tenant_key" ON "accounting_periods"("id", "organization_id", "company_id");
CREATE INDEX "accounting_periods_company_dates_status_idx"
  ON "accounting_periods"("company_id", "start_date", "end_date", "status");
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_year_tenant_fkey"
  FOREIGN KEY ("fiscal_year_id", "organization_id", "company_id")
  REFERENCES "fiscal_years"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE TABLE "journal_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "fiscal_year_id" UUID NOT NULL,
  "entry_number" BIGINT NOT NULL,
  "entry_date" DATE NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "source_type" "JournalSourceType" NOT NULL,
  "source_id" UUID,
  "idempotency_key" VARCHAR(128),
  "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "reversal_of_id" UUID,
  "created_by_id" UUID,
  "posted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_entries_posted_check" CHECK (
    ("status" = 'DRAFT' AND "posted_at" IS NULL)
    OR ("status" = 'POSTED' AND "posted_at" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "journal_entries_year_number_key"
  ON "journal_entries"("company_id", "fiscal_year_id", "entry_number");
CREATE UNIQUE INDEX "journal_entries_source_key"
  ON "journal_entries"("company_id", "source_type", "source_id");
CREATE UNIQUE INDEX "journal_entries_idempotency_key"
  ON "journal_entries"("company_id", "idempotency_key");
CREATE UNIQUE INDEX "journal_entries_reversal_key"
  ON "journal_entries"("reversal_of_id", "organization_id", "company_id");
CREATE UNIQUE INDEX "journal_entries_id_tenant_key"
  ON "journal_entries"("id", "organization_id", "company_id");
CREATE INDEX "journal_entries_company_date_number_idx"
  ON "journal_entries"("company_id", "entry_date", "entry_number");
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_year_tenant_fkey"
  FOREIGN KEY ("fiscal_year_id", "organization_id", "company_id")
  REFERENCES "fiscal_years"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_tenant_fkey"
  FOREIGN KEY ("reversal_of_id", "organization_id", "company_id")
  REFERENCES "journal_entries"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;

CREATE TABLE "journal_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "journal_entry_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "contact_id" UUID,
  "position" INTEGER NOT NULL,
  "description" VARCHAR(1000),
  "debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "journal_lines_amount_check" CHECK (
    ("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)
  )
);
CREATE UNIQUE INDEX "journal_lines_entry_position_key" ON "journal_lines"("journal_entry_id", "position");
CREATE INDEX "journal_lines_company_account_created_idx" ON "journal_lines"("company_id", "account_id", "created_at");
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_tenant_fkey"
  FOREIGN KEY ("journal_entry_id", "organization_id", "company_id")
  REFERENCES "journal_entries"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_tenant_fkey"
  FOREIGN KEY ("account_id", "organization_id", "company_id")
  REFERENCES "accounts"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_contact_tenant_fkey"
  FOREIGN KEY ("contact_id", "organization_id", "company_id")
  REFERENCES "contacts"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE FUNCTION validate_journal_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total_debit DECIMAL(19,4);
  total_credit DECIMAL(19,4);
  line_count INTEGER;
BEGIN
  IF NEW."status" = 'POSTED' AND OLD."status" = 'DRAFT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "fiscal_years" y
      WHERE y."id" = NEW."fiscal_year_id" AND y."status" = 'OPEN'
        AND NEW."entry_date" BETWEEN y."start_date" AND y."end_date"
    ) THEN RAISE EXCEPTION 'journal entry fiscal year is closed or does not contain entry date';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "accounting_periods" p
      WHERE p."fiscal_year_id" = NEW."fiscal_year_id" AND p."status" = 'LOCKED'
        AND NEW."entry_date" BETWEEN p."start_date" AND p."end_date"
    ) THEN RAISE EXCEPTION 'accounting period is locked';
    END IF;
    SELECT COUNT(*), COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0)
      INTO line_count, total_debit, total_credit
      FROM "journal_lines" WHERE "journal_entry_id" = NEW."id";
    IF line_count < 2 OR total_debit <= 0 OR total_debit <> total_credit THEN
      RAISE EXCEPTION 'journal entry must contain balanced debit and credit lines';
    END IF;
    NEW."posted_at" := COALESCE(NEW."posted_at", CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "journal_entries_validate_posting"
BEFORE UPDATE OF "status" ON "journal_entries"
FOR EACH ROW EXECUTE FUNCTION validate_journal_posting();

CREATE FUNCTION enforce_posted_journal_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'POSTED' THEN RAISE EXCEPTION 'posted journal entries are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "journal_entries_immutability"
BEFORE UPDATE OR DELETE ON "journal_entries"
FOR EACH ROW EXECUTE FUNCTION enforce_posted_journal_immutability();

CREATE FUNCTION enforce_journal_line_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status "JournalEntryStatus";
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT "status" INTO parent_status FROM "journal_entries"
      WHERE "id" = NEW."journal_entry_id";
  ELSE
    SELECT "status" INTO parent_status FROM "journal_entries"
      WHERE "id" = OLD."journal_entry_id";
  END IF;
  IF parent_status = 'POSTED' THEN RAISE EXCEPTION 'posted journal lines are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "journal_lines_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "journal_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_journal_line_immutability();

CREATE FUNCTION enforce_locked_period_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'LOCKED' THEN RAISE EXCEPTION 'locked accounting periods are immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "accounting_periods_immutability"
BEFORE UPDATE OR DELETE ON "accounting_periods"
FOR EACH ROW EXECUTE FUNCTION enforce_locked_period_immutability();

DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['accounts','fiscal_years','accounting_periods','journal_entries','journal_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_name || '_organization_isolation', table_name
    );
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'account.read', 'Read chart of accounts'),
  (gen_random_uuid(), 'account.manage', 'Manage chart of accounts'),
  (gen_random_uuid(), 'fiscal_year.read', 'Read fiscal years and periods'),
  (gen_random_uuid(), 'fiscal_year.manage', 'Manage fiscal years'),
  (gen_random_uuid(), 'accounting_period.lock', 'Lock accounting periods'),
  (gen_random_uuid(), 'journal_entry.read', 'Read journal entries'),
  (gen_random_uuid(), 'journal_entry.create', 'Create manual journal entries'),
  (gen_random_uuid(), 'journal_entry.reverse', 'Reverse journal entries')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner'
  AND (p."code" LIKE 'account.%' OR p."code" LIKE 'fiscal_year.%'
    OR p."code" LIKE 'accounting_period.%' OR p."code" LIKE 'journal_entry.%')
ON CONFLICT DO NOTHING;
