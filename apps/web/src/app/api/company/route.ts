import { NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET() {
  return forward("/v1/companies/current");
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (!body)
    return NextResponse.json({ error: "Datos de empresa no válidos." }, { status: 400 });
  const sanitized = sanitizeCompanyPatch(body);
  return forward("/v1/companies/current", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sanitized),
  });
}

const documentProfileFields = new Set([
  "tradeName",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "city",
  "province",
  "addressCountry",
  "email",
  "phone",
  "website",
  "bankIban",
  "paymentInstructions",
  "paymentTerms",
  "defaultNotes",
  "documentFooter",
  "primaryColor",
  "invoiceEmailSubjectTemplate",
  "quoteEmailSubjectTemplate",
  "emailBodyTemplate",
]);

function sanitizeCompanyPatch(body: unknown) {
  if (!isRecord(body) || !isRecord(body.documentProfile)) return body;
  return {
    ...body,
    documentProfile: Object.fromEntries(
      Object.entries(body.documentProfile).filter(([key]) =>
        documentProfileFields.has(key),
      ),
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function forward(path: string, init?: RequestInit) {
  try {
    const response = await tenantApiRequest(path, init);
    const body = await response.json().catch(() => undefined);
    if (!response.ok)
      return NextResponse.json({ error: normalizeApiError(body) }, { status: response.status });
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No podemos conectar con el servicio." }, { status: 503 });
  }
}
