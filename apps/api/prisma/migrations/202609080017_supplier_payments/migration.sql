ALTER TYPE "JournalSourceType" ADD VALUE 'SUPPLIER_PAYMENT';

ALTER TABLE "purchase_invoices"
  ADD COLUMN "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amount_due" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "purchase_invoices"
SET "amount_due" = "total"
WHERE "status" = 'APPROVED';

ALTER TABLE "purchase_invoices"
  ADD CONSTRAINT "purchase_invoices_payment_balance_check" CHECK (
    "amount_paid" >= 0
    AND "amount_due" >= 0
    AND (
      ("status" IN ('DRAFT', 'CANCELLED') AND "amount_paid" = 0 AND "amount_due" = 0)
      OR
      ("status" = 'APPROVED' AND "amount_paid" + "amount_due" = "total")
    )
  );

CREATE TABLE "supplier_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "paid_at" TIMESTAMPTZ(6) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "reference" VARCHAR(240),
  "notes" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_payments_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "supplier_payments_company_key_key"
  ON "supplier_payments"("company_id", "idempotency_key");
CREATE UNIQUE INDEX "supplier_payments_id_tenant_key"
  ON "supplier_payments"("id", "organization_id", "company_id");
CREATE INDEX "supplier_payments_invoice_paid_at_idx"
  ON "supplier_payments"("purchase_invoice_id", "paid_at");
CREATE INDEX "supplier_payments_company_paid_at_idx"
  ON "supplier_payments"("company_id", "paid_at");

ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "supplier_payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_payments_organization_isolation" ON "supplier_payments"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "supplier_payments" FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION enforce_purchase_invoice_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'approved purchase invoices are immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' AND
     (to_jsonb(NEW) - ARRAY['amount_paid', 'amount_due', 'updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['amount_paid', 'amount_due', 'updated_at']) THEN
    RAISE EXCEPTION 'approved purchase invoices are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION prevent_supplier_payment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'recorded supplier payments are immutable';
END;
$$;

CREATE TRIGGER "supplier_payments_immutable"
BEFORE UPDATE OR DELETE ON "supplier_payments"
FOR EACH ROW EXECUTE FUNCTION prevent_supplier_payment_mutation();

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'supplier_payment.read', 'Read supplier payments'),
  (gen_random_uuid(), 'supplier_payment.create', 'Record supplier payments')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner'
  AND p."code" IN ('supplier_payment.read', 'supplier_payment.create')
ON CONFLICT DO NOTHING;
