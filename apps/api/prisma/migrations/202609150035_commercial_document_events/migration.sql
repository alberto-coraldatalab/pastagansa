CREATE TYPE "CommercialDocumentEventType" AS ENUM (
  'SENT', 'DELIVERY_FAILED', 'ACCEPTED', 'REJECTED', 'DISPUTED',
  'PARTIALLY_PAID', 'PAID', 'PAYMENT_PROMISED'
);
CREATE TYPE "CommercialEventSource" AS ENUM ('USER', 'EMAIL', 'BANK', 'SYSTEM', 'EINVOICE');

CREATE TABLE "commercial_document_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "invoice_id" UUID,
  "quote_id" UUID,
  "payment_id" UUID,
  "correction_of_id" UUID,
  "actor_user_id" UUID,
  "type" "CommercialDocumentEventType" NOT NULL,
  "source" "CommercialEventSource" NOT NULL,
  "external_id" VARCHAR(240),
  "effective_at" TIMESTAMPTZ(6) NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comment" VARCHAR(1000),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_document_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_document_events_target_check" CHECK (
    ("invoice_id" IS NOT NULL AND "quote_id" IS NULL)
    OR ("invoice_id" IS NULL AND "quote_id" IS NOT NULL)
  ),
  CONSTRAINT "commercial_document_events_payment_check" CHECK (
    ("type" IN ('PARTIALLY_PAID', 'PAID') AND "payment_id" IS NOT NULL)
    OR ("type" NOT IN ('PARTIALLY_PAID', 'PAID') AND "payment_id" IS NULL)
  )
);

ALTER TABLE "commercial_document_events"
  ADD CONSTRAINT "commercial_document_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "commercial_document_events_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "commercial_document_events_invoice_tenant_fkey"
    FOREIGN KEY ("invoice_id", "organization_id", "company_id") REFERENCES "invoices"("id", "organization_id", "company_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "commercial_document_events_quote_tenant_fkey"
    FOREIGN KEY ("quote_id", "organization_id", "company_id") REFERENCES "quotes"("id", "organization_id", "company_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "commercial_document_events_payment_tenant_fkey"
    FOREIGN KEY ("payment_id", "organization_id", "company_id") REFERENCES "payments"("id", "organization_id", "company_id") ON DELETE RESTRICT;

CREATE UNIQUE INDEX "commercial_document_events_company_source_external_key"
  ON "commercial_document_events"("company_id", "source", "external_id");
CREATE INDEX "commercial_document_events_invoice_effective_at_id_idx"
  ON "commercial_document_events"("invoice_id", "effective_at", "id");
CREATE INDEX "commercial_document_events_quote_effective_at_id_idx"
  ON "commercial_document_events"("quote_id", "effective_at", "id");
CREATE INDEX "commercial_document_events_company_type_effective_at_idx"
  ON "commercial_document_events"("company_id", "type", "effective_at");

ALTER TABLE "commercial_document_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_document_events_organization_isolation" ON "commercial_document_events"
  USING ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK ("organization_id" = NULLIF(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE "commercial_document_events" FORCE ROW LEVEL SECURITY;

INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'collections.read', 'Read commercial event timelines'),
  (gen_random_uuid(), 'collections.manage', 'Record commercial collection events'),
  (gen_random_uuid(), 'quotes.manage', 'Record commercial quote events')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT DISTINCT rp."role_id", target."id"
FROM "role_permissions" rp
JOIN "permissions" legacy ON legacy."id" = rp."permission_id"
JOIN "permissions" target ON target."code" IN ('collections.read', 'collections.manage', 'quotes.manage')
WHERE legacy."code" IN ('payment.read', 'payment.create', 'quote.change_status')
ON CONFLICT DO NOTHING;
