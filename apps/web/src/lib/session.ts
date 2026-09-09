export interface IdentityContext {
  id: string;
  email: string;
  memberships: Membership[];
}

export interface Membership {
  organization: { id: string; name: string };
  company: {
    id: string;
    legalName: string;
    taxId: string;
    country: string;
    baseCurrency: string;
    timezone: string;
  } | null;
  role: { code: string; name: string; permissions: string[] };
}

export interface TenantSelection {
  organizationId: string;
  companyId: string;
}

export function selectMembership(
  context: IdentityContext,
  selected?: TenantSelection,
) {
  const companyMemberships = context.memberships.filter(
    (
      membership,
    ): membership is Membership & {
      company: NonNullable<Membership["company"]>;
    } => membership.company !== null,
  );
  if (selected) {
    const current = companyMemberships.find(
      ({ organization, company }) =>
        organization.id === selected.organizationId &&
        company.id === selected.companyId,
    );
    if (current) return current;
  }
  return companyMemberships[0];
}

export function normalizeApiError(body: unknown) {
  if (!body || typeof body !== "object" || !("error" in body))
    return "No hemos podido completar la operación.";
  const detail = body.error;
  if (typeof detail === "string") return translateApiError(detail);
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = detail.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return translateApiError(message);
  }
  return "No hemos podido completar la operación.";
}

function translateApiError(message: string) {
  const translations: Record<string, string> = {
    "A contact with this tax ID already exists":
      "Ya existe un contacto con este NIF.",
    "A catalog item with this SKU already exists":
      "Ya existe un elemento del catálogo con este SKU.",
    "Document series already exists":
      "Ya existe esta serie de facturación. Recarga y selecciónala.",
    "Invoice has already been issued": "La factura ya ha sido emitida.",
    "Invoice no longer exists or is no longer a draft":
      "La factura ya no existe o ha dejado de ser un borrador.",
    "dueDate cannot precede issueDate":
      "El vencimiento no puede ser anterior a la fecha de emisión.",
    "Payment amount cannot exceed the invoice amount due":
      "El cobro no puede superar el saldo pendiente de la factura.",
    "Invoice is not eligible for a payment":
      "Esta factura no admite nuevos cobros en su estado actual.",
    "Idempotency-Key has already been used for another payment":
      "La referencia segura del cobro ya se utilizó en otra operación.",
  };
  return translations[message] ?? message;
}
