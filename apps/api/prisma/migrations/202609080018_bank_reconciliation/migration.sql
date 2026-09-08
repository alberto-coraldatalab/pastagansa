CREATE TYPE "BankTransactionStatus" AS ENUM ('UNMATCHED', 'RECONCILED');

CREATE TABLE "bank_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "name" VARCHAR(240) NOT NULL,
  "iban" VARCHAR(34),
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bank_accounts_company_account_key"
  ON "bank_accounts"("company_id", "account_id");
CREATE UNIQUE INDEX "bank_accounts_company_iban_key"
  ON "bank_accounts"("company_id", "iban");
CREATE UNIQUE INDEX "bank_accounts_id_tenant_key"
  ON "bank_accounts"("id", "organization_id", "company_id");
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_tenant_fkey"
  FOREIGN KEY ("account_id", "organization_id", "company_id")
  REFERENCES "accounts"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE TABLE "bank_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "bank_account_id" UUID NOT NULL,
  "external_id" VARCHAR(240) NOT NULL,
  "booking_date" DATE NOT NULL,
  "value_date" DATE,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "counterparty_name" VARCHAR(240),
  "counterparty_iban" VARCHAR(34),
  "reference" VARCHAR(240),
  "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
  "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_transactions_amount_check" CHECK ("amount" <> 0)
);
CREATE UNIQUE INDEX "bank_transactions_account_external_key"
  ON "bank_transactions"("bank_account_id", "external_id");
CREATE UNIQUE INDEX "bank_transactions_id_tenant_key"
  ON "bank_transactions"("id", "organization_id", "company_id");
CREATE INDEX "bank_transactions_company_status_date_id_idx"
  ON "bank_transactions"("company_id", "status", "booking_date", "id");
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_account_tenant_fkey"
  FOREIGN KEY ("bank_account_id", "organization_id", "company_id")
  REFERENCES "bank_accounts"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE UNIQUE INDEX "journal_lines_id_tenant_key"
  ON "journal_lines"("id", "organization_id", "company_id");

CREATE TABLE "bank_reconciliations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "bank_transaction_id" UUID NOT NULL,
  "journal_line_id" UUID NOT NULL,
  "reconciled_by_id" UUID NOT NULL,
  "reconciled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bank_reconciliations_transaction_key"
  ON "bank_reconciliations"("bank_transaction_id");
CREATE UNIQUE INDEX "bank_reconciliations_journal_line_key"
  ON "bank_reconciliations"("journal_line_id");
CREATE UNIQUE INDEX "bank_reconciliations_transaction_tenant_key"
  ON "bank_reconciliations"("bank_transaction_id", "organization_id", "company_id");
CREATE UNIQUE INDEX "bank_reconciliations_line_tenant_key"
  ON "bank_reconciliations"("journal_line_id", "organization_id", "company_id");
CREATE UNIQUE INDEX "bank_reconciliations_id_tenant_key"
  ON "bank_reconciliations"("id", "organization_id", "company_id");
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_transaction_tenant_fkey"
  FOREIGN KEY ("bank_transaction_id", "organization_id", "company_id")
  REFERENCES "bank_transactions"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_line_tenant_fkey"
  FOREIGN KEY ("journal_line_id", "organization_id", "company_id")
  REFERENCES "journal_lines"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_user_fkey"
  FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;

CREATE FUNCTION enforce_bank_account_mapping_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW."account_id" <> OLD."account_id" OR NEW."currency" <> OLD."currency" OR
      NEW."organization_id" <> OLD."organization_id" OR NEW."company_id" <> OLD."company_id") THEN
    RAISE EXCEPTION 'bank account ledger mapping and currency are immutable';
  END IF;
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1 FROM "bank_transactions" t WHERE t."bank_account_id" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'bank accounts with imported transactions cannot be deleted';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "bank_accounts_mapping_immutability"
BEFORE UPDATE OR DELETE ON "bank_accounts"
FOR EACH ROW EXECUTE FUNCTION enforce_bank_account_mapping_immutability();

CREATE FUNCTION enforce_bank_transaction_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" = 'RECONCILED' OR
     (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') OR
     NEW."status" <> 'RECONCILED' OR NOT EXISTS (
       SELECT 1 FROM "bank_reconciliations" r
       WHERE r."bank_transaction_id" = OLD."id"
     ) THEN
    RAISE EXCEPTION 'imported bank transaction contents are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "bank_transactions_immutability"
BEFORE UPDATE OR DELETE ON "bank_transactions"
FOR EACH ROW EXECUTE FUNCTION enforce_bank_transaction_immutability();

CREATE FUNCTION validate_bank_reconciliation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  transaction_status "BankTransactionStatus";
  transaction_amount DECIMAL(14,2);
  bank_accounting_id UUID;
  line_debit DECIMAL(19,4);
  line_credit DECIMAL(19,4);
  entry_status "JournalEntryStatus";
BEGIN
  SELECT t."status", t."amount", b."account_id"
    INTO transaction_status, transaction_amount, bank_accounting_id
  FROM "bank_transactions" t
  JOIN "bank_accounts" b ON b."id" = t."bank_account_id"
  WHERE t."id" = NEW."bank_transaction_id"
    AND t."organization_id" = NEW."organization_id"
    AND t."company_id" = NEW."company_id";

  SELECT l."debit", l."credit", e."status"
    INTO line_debit, line_credit, entry_status
  FROM "journal_lines" l
  JOIN "journal_entries" e ON e."id" = l."journal_entry_id"
  WHERE l."id" = NEW."journal_line_id"
    AND l."organization_id" = NEW."organization_id"
    AND l."company_id" = NEW."company_id"
    AND l."account_id" = bank_accounting_id;

  IF transaction_status IS DISTINCT FROM 'UNMATCHED' OR entry_status IS DISTINCT FROM 'POSTED' OR
     (transaction_amount > 0 AND (line_debit <> transaction_amount OR line_credit <> 0)) OR
     (transaction_amount < 0 AND (line_credit <> -transaction_amount OR line_debit <> 0)) THEN
    RAISE EXCEPTION 'bank reconciliation must match an unreconciled transaction to an equal posted bank line';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "bank_reconciliations_validate"
BEFORE INSERT ON "bank_reconciliations"
FOR EACH ROW EXECUTE FUNCTION validate_bank_reconciliation();

CREATE FUNCTION prevent_bank_reconciliation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'bank reconciliations are append-only';
END;
$$;
CREATE TRIGGER "bank_reconciliations_immutable"
BEFORE UPDATE OR DELETE ON "bank_reconciliations"
FOR EACH ROW EXECUTE FUNCTION prevent_bank_reconciliation_mutation();

DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['bank_accounts','bank_transactions','bank_reconciliations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = NULLIF(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_name || '_organization_isolation', table_name
    );
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'bank_account.read', 'Read bank accounts'),
  (gen_random_uuid(), 'bank_account.manage', 'Manage bank accounts'),
  (gen_random_uuid(), 'bank_transaction.read', 'Read bank transactions and suggestions'),
  (gen_random_uuid(), 'bank_transaction.import', 'Import bank transactions'),
  (gen_random_uuid(), 'bank_transaction.reconcile', 'Reconcile bank transactions')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner'
  AND (p."code" LIKE 'bank_account.%' OR p."code" LIKE 'bank_transaction.%')
ON CONFLICT DO NOTHING;
