CREATE FUNCTION enforce_issued_invoice_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'issued invoices cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' THEN
    IF NEW."status" = 'DRAFT' OR
       (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
      RAISE EXCEPTION 'issued invoice contents are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "issued_invoice_immutability"
BEFORE UPDATE OR DELETE ON "invoices"
FOR EACH ROW EXECUTE FUNCTION enforce_issued_invoice_immutability();

CREATE FUNCTION enforce_issued_invoice_line_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_invoice_issued boolean := false;
  new_invoice_issued boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT "status" <> 'DRAFT' INTO old_invoice_issued
    FROM "invoices"
    WHERE "id" = OLD."invoice_id";
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT "status" <> 'DRAFT' INTO new_invoice_issued
    FROM "invoices"
    WHERE "id" = NEW."invoice_id";
  END IF;

  IF old_invoice_issued OR new_invoice_issued THEN
    RAISE EXCEPTION 'issued invoice lines are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "issued_invoice_line_immutability"
BEFORE INSERT OR UPDATE OR DELETE ON "invoice_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_issued_invoice_line_immutability();
