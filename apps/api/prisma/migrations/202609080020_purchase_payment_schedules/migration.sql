ALTER TABLE "purchase_invoices" ADD COLUMN "due_date" DATE;

UPDATE "purchase_invoices"
SET "due_date" = "issue_date"
WHERE "status" = 'APPROVED';

CREATE TABLE "purchase_invoice_installments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "due_date" DATE NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoice_installments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_installments_position_check" CHECK ("position" > 0),
  CONSTRAINT "purchase_invoice_installments_amount_check" CHECK (
    "amount" > 0 AND "paid_amount" >= 0 AND "paid_amount" <= "amount"
  ),
  CONSTRAINT "purchase_invoice_installments_status_check" CHECK (
    ("status" = 'PENDING' AND "paid_amount" = 0)
    OR ("status" = 'PARTIALLY_PAID' AND "paid_amount" > 0 AND "paid_amount" < "amount")
    OR ("status" = 'PAID' AND "paid_amount" = "amount")
  )
);

CREATE TABLE "supplier_payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "supplier_payment_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "installment_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_payment_allocations_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "purchase_installments_invoice_position_key"
  ON "purchase_invoice_installments"("purchase_invoice_id", "position");
CREATE UNIQUE INDEX "purchase_installments_id_tenant_key"
  ON "purchase_invoice_installments"("id", "organization_id", "company_id");
CREATE UNIQUE INDEX "purchase_installments_id_invoice_tenant_key"
  ON "purchase_invoice_installments"("id", "purchase_invoice_id", "organization_id", "company_id");
CREATE INDEX "purchase_installments_company_status_due_idx"
  ON "purchase_invoice_installments"("company_id", "status", "due_date");
CREATE UNIQUE INDEX "supplier_payments_id_invoice_tenant_key"
  ON "supplier_payments"("id", "purchase_invoice_id", "organization_id", "company_id");
CREATE UNIQUE INDEX "supplier_allocations_payment_installment_key"
  ON "supplier_payment_allocations"("supplier_payment_id", "installment_id");
CREATE INDEX "supplier_allocations_invoice_created_idx"
  ON "supplier_payment_allocations"("purchase_invoice_id", "created_at");

ALTER TABLE "purchase_invoice_installments" ADD CONSTRAINT "purchase_installments_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_installments" ADD CONSTRAINT "purchase_installments_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_installments" ADD CONSTRAINT "purchase_installments_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT;

ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_allocations_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_allocations_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_allocations_payment_tenant_fkey"
  FOREIGN KEY ("supplier_payment_id", "purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "supplier_payments"("id", "purchase_invoice_id", "organization_id", "company_id") ON DELETE RESTRICT;
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_allocations_installment_tenant_fkey"
  FOREIGN KEY ("installment_id", "purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoice_installments"("id", "purchase_invoice_id", "organization_id", "company_id") ON DELETE RESTRICT;

INSERT INTO "purchase_invoice_installments" (
  "organization_id", "company_id", "purchase_invoice_id", "position",
  "due_date", "amount", "paid_amount", "status"
)
SELECT
  "organization_id", "company_id", "id", 1, "due_date", "total", "amount_paid",
  CASE
    WHEN "amount_paid" = 0 THEN 'PENDING'::"InstallmentStatus"
    WHEN "amount_paid" = "total" THEN 'PAID'::"InstallmentStatus"
    ELSE 'PARTIALLY_PAID'::"InstallmentStatus"
  END
FROM "purchase_invoices"
WHERE "status" = 'APPROVED' AND "total" > 0;

INSERT INTO "supplier_payment_allocations" (
  "organization_id", "company_id", "supplier_payment_id",
  "purchase_invoice_id", "installment_id", "amount", "created_at"
)
SELECT
  p."organization_id", p."company_id", p."id", p."purchase_invoice_id",
  i."id", p."amount", p."created_at"
FROM "supplier_payments" p
JOIN "purchase_invoice_installments" i
  ON i."purchase_invoice_id" = p."purchase_invoice_id" AND i."position" = 1;

ALTER TABLE "purchase_invoice_installments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_installments_organization_isolation" ON "purchase_invoice_installments"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_invoice_installments" FORCE ROW LEVEL SECURITY;

ALTER TABLE "supplier_payment_allocations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_allocations_organization_isolation" ON "supplier_payment_allocations"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "supplier_payment_allocations" FORCE ROW LEVEL SECURITY;

CREATE FUNCTION enforce_purchase_installment_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_status "PurchaseInvoiceStatus";
  invoice_issue_date DATE;
  target_invoice_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN target_invoice_id := OLD."purchase_invoice_id";
  ELSE target_invoice_id := NEW."purchase_invoice_id";
  END IF;

  SELECT "status", "issue_date" INTO invoice_status, invoice_issue_date
  FROM "purchase_invoices" WHERE "id" = target_invoice_id;

  IF TG_OP <> 'DELETE' AND NEW."due_date" < invoice_issue_date THEN
    RAISE EXCEPTION 'purchase installment due date cannot precede invoice issue date';
  END IF;

  IF invoice_status <> 'DRAFT' AND (
    TG_OP IN ('INSERT', 'DELETE') OR
    (to_jsonb(NEW) - ARRAY['paid_amount', 'status', 'updated_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['paid_amount', 'status', 'updated_at'])
  ) THEN
    RAISE EXCEPTION 'approved purchase invoice payment schedules are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "purchase_installments_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_invoice_installments"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_installment_immutability();

CREATE FUNCTION validate_supplier_payment_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payment_amount DECIMAL(14,2);
  installment_amount DECIMAL(14,2);
  payment_allocated DECIMAL(14,2);
  installment_allocated DECIMAL(14,2);
BEGIN
  SELECT "amount" INTO payment_amount FROM "supplier_payments"
  WHERE "id" = NEW."supplier_payment_id";
  SELECT "amount" INTO installment_amount FROM "purchase_invoice_installments"
  WHERE "id" = NEW."installment_id";
  SELECT COALESCE(SUM("amount"), 0) INTO payment_allocated
  FROM "supplier_payment_allocations"
  WHERE "supplier_payment_id" = NEW."supplier_payment_id";
  SELECT COALESCE(SUM("amount"), 0) INTO installment_allocated
  FROM "supplier_payment_allocations"
  WHERE "installment_id" = NEW."installment_id";

  IF payment_allocated + NEW."amount" > payment_amount OR
     installment_allocated + NEW."amount" > installment_amount THEN
    RAISE EXCEPTION 'supplier payment allocation exceeds an available balance';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "supplier_allocations_validate"
BEFORE INSERT ON "supplier_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION validate_supplier_payment_allocation();

CREATE FUNCTION prevent_supplier_allocation_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'recorded supplier payment allocations are immutable';
END;
$$;

CREATE TRIGGER "supplier_allocations_immutable"
BEFORE UPDATE OR DELETE ON "supplier_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION prevent_supplier_allocation_mutation();
