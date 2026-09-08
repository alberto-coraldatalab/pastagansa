CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID');

ALTER TABLE "invoices"
  ADD COLUMN "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "amount_due" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "invoices"
SET "amount_due" = CASE
  WHEN "document_type" = 'CREDIT_NOTE' OR "status" IN ('RECTIFIED', 'CANCELLED') THEN 0
  ELSE "total"
END;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_payment_balance_check" CHECK (
    "amount_paid" >= 0
    AND "amount_due" >= 0
    AND (
      ("document_type" = 'CREDIT_NOTE' AND "amount_paid" = 0 AND "amount_due" = 0)
      OR
      (
        "document_type" = 'INVOICE'
        AND "status" IN ('RECTIFIED', 'CANCELLED')
        AND "amount_paid" <= "total"
        AND "amount_due" = 0
      )
      OR
      (
        "document_type" = 'INVOICE'
        AND "status" NOT IN ('RECTIFIED', 'CANCELLED')
        AND "amount_paid" + "amount_due" = "total"
      )
    )
  );

CREATE TABLE "invoice_installments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "due_date" DATE NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_installments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_installments_position_check" CHECK ("position" > 0),
  CONSTRAINT "invoice_installments_amount_check" CHECK (
    "amount" > 0 AND "paid_amount" >= 0 AND "paid_amount" <= "amount"
  ),
  CONSTRAINT "invoice_installments_status_check" CHECK (
    ("status" = 'PENDING' AND "paid_amount" = 0)
    OR ("status" = 'PARTIALLY_PAID' AND "paid_amount" > 0 AND "paid_amount" < "amount")
    OR ("status" = 'PAID' AND "paid_amount" = "amount")
  )
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "paid_at" TIMESTAMPTZ(6) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "reference" VARCHAR(240),
  "notes" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "installment_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_allocations_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "invoice_installments_invoice_id_position_key"
  ON "invoice_installments"("invoice_id", "position");
CREATE UNIQUE INDEX "invoice_installments_id_organization_id_company_id_key"
  ON "invoice_installments"("id", "organization_id", "company_id");
CREATE UNIQUE INDEX "invoice_installments_id_invoice_id_organization_id_company_id_key"
  ON "invoice_installments"("id", "invoice_id", "organization_id", "company_id");
CREATE INDEX "invoice_installments_company_id_status_due_date_idx"
  ON "invoice_installments"("company_id", "status", "due_date");
CREATE UNIQUE INDEX "payments_company_id_idempotency_key_key"
  ON "payments"("company_id", "idempotency_key");
CREATE UNIQUE INDEX "payments_id_organization_id_company_id_key"
  ON "payments"("id", "organization_id", "company_id");
CREATE INDEX "payments_company_id_paid_at_idx"
  ON "payments"("company_id", "paid_at");
CREATE UNIQUE INDEX "payment_allocations_payment_id_installment_id_key"
  ON "payment_allocations"("payment_id", "installment_id");
CREATE INDEX "payment_allocations_invoice_id_created_at_idx"
  ON "payment_allocations"("invoice_id", "created_at");

ALTER TABLE "invoice_installments" ADD CONSTRAINT "invoice_installments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_installments" ADD CONSTRAINT "invoice_installments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_installments" ADD CONSTRAINT "invoice_installments_invoice_tenant_fkey"
  FOREIGN KEY ("invoice_id", "organization_id", "company_id")
  REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_tenant_fkey"
  FOREIGN KEY ("payment_id", "organization_id", "company_id")
  REFERENCES "payments"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_tenant_fkey"
  FOREIGN KEY ("invoice_id", "organization_id", "company_id")
  REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installment_tenant_fkey"
  FOREIGN KEY ("installment_id", "invoice_id", "organization_id", "company_id")
  REFERENCES "invoice_installments"("id", "invoice_id", "organization_id", "company_id") ON DELETE RESTRICT;

INSERT INTO "invoice_installments" (
  "organization_id", "company_id", "invoice_id", "position", "due_date", "amount"
)
SELECT
  "organization_id", "company_id", "id", 1, COALESCE("due_date", "issue_date"), "total"
FROM "invoices"
WHERE "document_type" = 'INVOICE'
  AND "status" NOT IN ('DRAFT', 'RECTIFIED', 'CANCELLED')
  AND "total" > 0;

ALTER TABLE "invoice_installments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_installments_organization_isolation" ON "invoice_installments"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "invoice_installments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_organization_isolation" ON "payments"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_allocations_organization_isolation" ON "payment_allocations"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "payment_allocations" FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION enforce_issued_invoice_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'issued invoices cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' THEN
    IF NEW."status" = 'DRAFT' OR
       (to_jsonb(NEW) - ARRAY['status', 'amount_paid', 'amount_due', 'updated_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'amount_paid', 'amount_due', 'updated_at']) THEN
      RAISE EXCEPTION 'issued invoice contents are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_installment_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_status "InvoiceStatus";
  target_invoice_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_invoice_id := OLD."invoice_id";
  ELSE
    target_invoice_id := NEW."invoice_id";
  END IF;
  SELECT "status" INTO invoice_status
  FROM "invoices"
  WHERE "id" = target_invoice_id;

  IF invoice_status <> 'DRAFT' THEN
    IF TG_OP = 'DELETE' OR
       TG_OP = 'INSERT' OR
       (to_jsonb(NEW) - ARRAY['paid_amount', 'status', 'updated_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['paid_amount', 'status', 'updated_at']) THEN
      RAISE EXCEPTION 'issued invoice payment schedules are immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "installment_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "invoice_installments"
FOR EACH ROW EXECUTE FUNCTION enforce_installment_immutability();

CREATE FUNCTION prevent_payment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'recorded payments and allocations are immutable';
END;
$$;

CREATE TRIGGER "payments_immutable"
BEFORE UPDATE OR DELETE ON "payments"
FOR EACH ROW EXECUTE FUNCTION prevent_payment_mutation();
CREATE TRIGGER "payment_allocations_immutable"
BEFORE UPDATE OR DELETE ON "payment_allocations"
FOR EACH ROW EXECUTE FUNCTION prevent_payment_mutation();

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'payment.read', 'Read invoice payments'),
  (gen_random_uuid(), 'payment.create', 'Record invoice payments')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner'
  AND p."code" IN ('payment.read', 'payment.create')
ON CONFLICT DO NOTHING;
