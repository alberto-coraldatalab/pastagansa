-- The first snapshot migration only had the legacy invoice legal name and tax ID.
-- Enrich those explicitly-marked legacy records once from the current document
-- profile, without modifying snapshots that were captured at document creation.
ALTER TABLE "invoices" DISABLE TRIGGER "issued_invoice_immutability";
ALTER TABLE "invoices" DISABLE TRIGGER "rectification_original_integrity";

UPDATE "invoices" AS invoice
SET "issuer_snapshot" = jsonb_strip_nulls(jsonb_build_object(
  'version', 1,
  'source', 'legacy_backfill',
  'legalName', invoice."issuer_legal_name",
  'taxId', invoice."issuer_tax_id",
  'tradeName', profile."trade_name",
  'addressLine1', profile."address_line_1",
  'addressLine2', profile."address_line_2",
  'postalCode', profile."postal_code",
  'city', profile."city",
  'province', profile."province",
  'addressCountry', profile."address_country",
  'email', profile."email",
  'phone', profile."phone",
  'website', profile."website",
  'bankIban', profile."bank_iban",
  'paymentInstructions', profile."payment_instructions",
  'paymentTerms', profile."payment_terms",
  'defaultNotes', profile."default_notes",
  'documentFooter', profile."document_footer",
  'primaryColor', profile."primary_color"
))
FROM "company_document_profiles" AS profile
WHERE profile."company_id" = invoice."company_id"
  AND profile."organization_id" = invoice."organization_id"
  AND invoice."issuer_snapshot" ->> 'source' = 'legacy_backfill';

ALTER TABLE "invoices" ENABLE TRIGGER "issued_invoice_immutability";
ALTER TABLE "invoices" ENABLE TRIGGER "rectification_original_integrity";

UPDATE "quotes" AS quote
SET "issuer_snapshot" = jsonb_strip_nulls(jsonb_build_object(
  'version', 1,
  'source', 'legacy_backfill',
  'legalName', company."legal_name",
  'taxId', company."tax_id",
  'tradeName', profile."trade_name",
  'addressLine1', profile."address_line_1",
  'addressLine2', profile."address_line_2",
  'postalCode', profile."postal_code",
  'city', profile."city",
  'province', profile."province",
  'addressCountry', profile."address_country",
  'email', profile."email",
  'phone', profile."phone",
  'website', profile."website",
  'bankIban', profile."bank_iban",
  'paymentInstructions', profile."payment_instructions",
  'paymentTerms', profile."payment_terms",
  'defaultNotes', profile."default_notes",
  'documentFooter', profile."document_footer",
  'primaryColor', profile."primary_color"
))
FROM "companies" AS company
JOIN "company_document_profiles" AS profile
  ON profile."company_id" = company."id"
  AND profile."organization_id" = company."organization_id"
WHERE company."id" = quote."company_id"
  AND company."organization_id" = quote."organization_id"
  AND quote."issuer_snapshot" ->> 'source' = 'legacy_backfill';
