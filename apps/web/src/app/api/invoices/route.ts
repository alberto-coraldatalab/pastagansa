import { NextRequest, NextResponse } from "next/server";
import { invoiceInputSchema } from "@/lib/invoices";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const name of ["status", "cursor", "limit"] as const) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) params.set(name, value);
  }
  return forward(`/v1/invoices?${params.toString()}`);
}

export async function POST(request: Request) {
  const input = invoiceInputSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "Revisa el cliente, las fechas y las líneas de la factura." },
      { status: 400 },
    );
  return forward("/v1/invoices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...input.data,
      dueDate: input.data.dueDate || undefined,
      notes: input.data.notes || undefined,
    }),
  });
}

async function forward(path: string, init?: RequestInit) {
  try {
    const response = await tenantApiRequest(path, init);
    const body = await response.json().catch(() => undefined);
    if (!response.ok)
      return NextResponse.json(
        { error: normalizeApiError(body) },
        { status: response.status },
      );
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}
