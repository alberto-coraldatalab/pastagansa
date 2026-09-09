ALTER TABLE "purchase_invoices"
  ADD COLUMN "requested_sequence_id" UUID,
  ADD COLUMN "required_approvals" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "approval_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "purchase_invoices"
SET "approval_count" = 1
WHERE "status" = 'APPROVED';

ALTER TABLE "purchase_invoices" DROP CONSTRAINT "purchase_invoices_approval_check";
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_approval_check" CHECK (
  "required_approvals" BETWEEN 1 AND 5
  AND "approval_count" BETWEEN 0 AND "required_approvals"
  AND (
    ("status" = 'DRAFT' AND "sequence_id" IS NULL AND "requested_sequence_id" IS NULL
      AND "reception_number" IS NULL AND "reception_series" IS NULL
      AND "reception_full_number" IS NULL AND "approval_key" IS NULL
      AND "approved_at" IS NULL AND "approval_count" = 0)
    OR
    ("status" = 'PENDING_APPROVAL' AND "sequence_id" IS NULL
      AND "requested_sequence_id" IS NOT NULL AND "reception_number" IS NULL
      AND "reception_series" IS NULL AND "reception_full_number" IS NULL
      AND "approval_key" IS NULL AND "approved_at" IS NULL
      AND "approval_count" > 0 AND "approval_count" < "required_approvals")
    OR
    ("status" = 'APPROVED' AND "sequence_id" IS NOT NULL
      AND "requested_sequence_id" IS NULL AND "reception_number" IS NOT NULL
      AND "reception_series" IS NOT NULL AND "reception_full_number" IS NOT NULL
      AND "approval_key" IS NOT NULL AND "approved_at" IS NOT NULL
      AND "approval_count" = "required_approvals")
    OR "status" = 'CANCELLED'
  )
);

ALTER TABLE "purchase_invoices" DROP CONSTRAINT "purchase_invoices_payment_balance_check";
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_payment_balance_check" CHECK (
  "amount_paid" >= 0 AND "amount_due" >= 0
  AND (
    ("status" IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED')
      AND "amount_paid" = 0 AND "amount_due" = 0)
    OR
    ("status" = 'APPROVED' AND "amount_paid" + "amount_due" = "total")
  )
);

ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_requested_sequence_tenant_fkey"
  FOREIGN KEY ("requested_sequence_id", "organization_id", "company_id")
  REFERENCES "document_sequences"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE TABLE "purchase_approval_tiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "minimum_amount" DECIMAL(14,2) NOT NULL,
  "required_approvals" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_approval_tiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_approval_tiers_values_check" CHECK (
    "minimum_amount" >= 0 AND "required_approvals" BETWEEN 1 AND 5
  )
);

CREATE UNIQUE INDEX "purchase_approval_tiers_company_amount_key"
  ON "purchase_approval_tiers"("company_id", "minimum_amount");
CREATE UNIQUE INDEX "purchase_approval_tiers_id_tenant_key"
  ON "purchase_approval_tiers"("id", "organization_id", "company_id");
CREATE INDEX "purchase_approval_tiers_company_amount_idx"
  ON "purchase_approval_tiers"("company_id", "minimum_amount");

ALTER TABLE "purchase_approval_tiers" ADD CONSTRAINT "purchase_approval_tiers_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_approval_tiers" ADD CONSTRAINT "purchase_approval_tiers_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;

CREATE TABLE "purchase_invoice_approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "approved_by_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoice_approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_approvals_position_check" CHECK ("position" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "purchase_approvals_invoice_position_key"
  ON "purchase_invoice_approvals"("purchase_invoice_id", "position");
CREATE UNIQUE INDEX "purchase_approvals_invoice_actor_key"
  ON "purchase_invoice_approvals"("purchase_invoice_id", "approved_by_id");
CREATE UNIQUE INDEX "purchase_approvals_company_idempotency_key"
  ON "purchase_invoice_approvals"("company_id", "idempotency_key");
CREATE UNIQUE INDEX "purchase_approvals_id_tenant_key"
  ON "purchase_invoice_approvals"("id", "organization_id", "company_id");
CREATE INDEX "purchase_approvals_invoice_approved_at_idx"
  ON "purchase_invoice_approvals"("purchase_invoice_id", "approved_at");

ALTER TABLE "purchase_invoice_approvals" ADD CONSTRAINT "purchase_approvals_organization_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_approvals" ADD CONSTRAINT "purchase_approvals_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "purchase_invoice_approvals" ADD CONSTRAINT "purchase_approvals_invoice_tenant_fkey"
  FOREIGN KEY ("purchase_invoice_id", "organization_id", "company_id")
  REFERENCES "purchase_invoices"("id", "organization_id", "company_id") ON DELETE CASCADE;
ALTER TABLE "purchase_invoice_approvals" ADD CONSTRAINT "purchase_approvals_actor_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "purchase_approval_tiers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_approval_tiers_organization_isolation" ON "purchase_approval_tiers"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_approval_tiers" FORCE ROW LEVEL SECURITY;

ALTER TABLE "purchase_invoice_approvals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_approvals_organization_isolation" ON "purchase_invoice_approvals"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "purchase_invoice_approvals" FORCE ROW LEVEL SECURITY;

INSERT INTO "purchase_invoice_approvals" (
  "organization_id", "company_id", "purchase_invoice_id", "position",
  "approved_by_id", "idempotency_key", "approved_at"
)
SELECT
  p."organization_id", p."company_id", p."id", 1,
  COALESCE(event."actor_user_id", fallback."user_id"),
  p."approval_key", p."approved_at"
FROM "purchase_invoices" p
LEFT JOIN LATERAL (
  SELECT a."actor_user_id"
  FROM "audit_events" a
  WHERE a."organization_id" = p."organization_id"
    AND a."company_id" = p."company_id"
    AND a."entity_id" = p."id"
    AND a."action" = 'purchase_invoice.approved'
    AND a."actor_user_id" IS NOT NULL
  ORDER BY a."occurred_at" DESC
  LIMIT 1
) event ON true
JOIN LATERAL (
  SELECT m."user_id"
  FROM "memberships" m
  JOIN "role_permissions" rp ON rp."role_id" = m."role_id"
  JOIN "permissions" permission ON permission."id" = rp."permission_id"
  WHERE m."organization_id" = p."organization_id"
    AND (m."company_id" = p."company_id" OR m."company_id" IS NULL)
    AND m."status" = 'ACTIVE'
    AND permission."code" = 'purchase_invoice.approve'
  ORDER BY (m."company_id" IS NOT NULL) DESC, m."user_id"
  LIMIT 1
) fallback ON true
WHERE p."status" = 'APPROVED';

CREATE OR REPLACE FUNCTION enforce_purchase_invoice_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'submitted purchase invoices are immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'APPROVED' AND
     (to_jsonb(NEW) - ARRAY[
       'status', 'requested_sequence_id', 'sequence_id', 'reception_series',
       'reception_number', 'reception_full_number', 'approval_key',
       'required_approvals', 'approval_count', 'amount_paid', 'amount_due',
       'approved_at', 'updated_at'
     ]) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY[
       'status', 'requested_sequence_id', 'sequence_id', 'reception_series',
       'reception_number', 'reception_full_number', 'approval_key',
       'required_approvals', 'approval_count', 'amount_paid', 'amount_due',
       'approved_at', 'updated_at'
     ]) THEN
    RAISE EXCEPTION 'approved purchase invoices are immutable';
  END IF;
  IF OLD."status" = 'PENDING_APPROVAL' AND
     (to_jsonb(NEW) - ARRAY[
       'status', 'requested_sequence_id', 'sequence_id', 'reception_series',
       'reception_number', 'reception_full_number', 'approval_key',
       'required_approvals', 'approval_count', 'amount_paid', 'amount_due',
       'approved_at', 'updated_at'
     ]) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY[
       'status', 'requested_sequence_id', 'sequence_id', 'reception_series',
       'reception_number', 'reception_full_number', 'approval_key',
       'required_approvals', 'approval_count', 'amount_paid', 'amount_due',
       'approved_at', 'updated_at'
     ]) THEN
    RAISE EXCEPTION 'submitted purchase invoices are immutable';
  END IF;
  IF OLD."status" = 'APPROVED' AND NEW."status" <> 'APPROVED' THEN
    RAISE EXCEPTION 'approved purchase invoices are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_purchase_approval_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_status "PurchaseInvoiceStatus";
  current_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'purchase approvals are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT "status" INTO invoice_status FROM "purchase_invoices"
    WHERE "id" = OLD."purchase_invoice_id";
    IF invoice_status <> 'PENDING_APPROVAL' THEN
      RAISE EXCEPTION 'purchase approvals are immutable';
    END IF;
    RETURN OLD;
  END IF;

  SELECT "status", "approval_count" INTO invoice_status, current_count
  FROM "purchase_invoices" WHERE "id" = NEW."purchase_invoice_id";
  IF invoice_status NOT IN ('DRAFT', 'PENDING_APPROVAL')
     OR NEW."position" <> current_count + 1 THEN
    RAISE EXCEPTION 'purchase approval is out of sequence';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "memberships" m
    JOIN "role_permissions" rp ON rp."role_id" = m."role_id"
    JOIN "permissions" p ON p."id" = rp."permission_id"
    WHERE m."organization_id" = NEW."organization_id"
      AND (m."company_id" = NEW."company_id" OR m."company_id" IS NULL)
      AND m."user_id" = NEW."approved_by_id"
      AND m."status" = 'ACTIVE'
      AND p."code" = 'purchase_invoice.approve'
  ) THEN
    RAISE EXCEPTION 'purchase approver lacks an active authorized membership';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "purchase_approvals_integrity"
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_invoice_approvals"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_approval_integrity();

CREATE FUNCTION validate_purchase_approval_count() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  invoice_id UUID;
  stored_count INTEGER;
  actual_count INTEGER;
  invoice_status "PurchaseInvoiceStatus";
BEGIN
  IF TG_TABLE_NAME = 'purchase_invoices' THEN invoice_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN invoice_id := OLD."purchase_invoice_id";
  ELSE invoice_id := NEW."purchase_invoice_id";
  END IF;

  SELECT "status", "approval_count" INTO invoice_status, stored_count
  FROM "purchase_invoices" WHERE "id" = invoice_id;
  IF invoice_status IS NULL THEN RETURN NULL; END IF;
  SELECT COUNT(*) INTO actual_count FROM "purchase_invoice_approvals"
  WHERE "purchase_invoice_id" = invoice_id;
  IF invoice_status <> 'CANCELLED' AND stored_count <> actual_count THEN
    RAISE EXCEPTION 'purchase invoice approval count does not match its decisions';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "purchase_invoice_approval_count_consistency"
AFTER INSERT OR UPDATE ON "purchase_invoices"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_purchase_approval_count();

CREATE CONSTRAINT TRIGGER "purchase_approval_count_consistency"
AFTER INSERT OR DELETE ON "purchase_invoice_approvals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_purchase_approval_count();

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'purchase_invoice.approval_policy.manage', 'Manage purchase approval policy')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."code" = 'organization.owner'
  AND p."code" = 'purchase_invoice.approval_policy.manage'
ON CONFLICT DO NOTHING;
