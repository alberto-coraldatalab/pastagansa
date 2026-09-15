import { NextRequest, NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const allowed = [
  "asOf",
  "bucket",
  "status",
  "text",
  "cursor",
  "limit",
] as const;

export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const name of allowed) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) params.set(name, value);
  }
  try {
    const response = await tenantApiRequest(
      `/v1/collections/invoices?${params}`,
    );
    const body = await response.json().catch(() => undefined);
    if (!response.ok)
      return NextResponse.json(
        { error: normalizeApiError(body) },
        { status: response.status },
      );
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No podemos cargar las facturas pendientes." },
      { status: 503 },
    );
  }
}
