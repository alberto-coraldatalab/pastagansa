-- Affected rows can reach FAILED before the corrective migration is deployed.
-- Their SMTP send already completed; only the subsequent event write failed.
WITH recovered AS (
  UPDATE "document_deliveries"
  SET
    "status" = 'SENT',
    "sent_at" = COALESCE("sent_at", "updated_at"),
    "locked_at" = NULL,
    "last_error" = NULL,
    "provider" = COALESCE("provider", 'smtp'),
    "updated_at" = CURRENT_TIMESTAMP
  WHERE "status" = 'FAILED'
    AND "last_error" LIKE '%Unknown argument `purpose`%'
  RETURNING
    "id", "organization_id", "company_id", "invoice_id", "quote_id",
    "purpose", "sent_at"
)
INSERT INTO "commercial_document_events" (
  "id", "organization_id", "company_id", "invoice_id", "quote_id",
  "type", "source", "external_id", "effective_at", "payload"
)
SELECT
  gen_random_uuid(),
  "organization_id", "company_id", "invoice_id", "quote_id",
  'SENT', 'EMAIL', 'delivery:' || "id" || ':sent', "sent_at",
  jsonb_build_object(
    'schemaVersion', 1,
    'deliveryId', "id",
    'purpose', "purpose",
    'provider', 'smtp',
    'recovered', true
  )
FROM recovered
ON CONFLICT ("company_id", "source", "external_id") DO NOTHING;
