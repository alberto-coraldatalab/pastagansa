import { NextRequest, NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const name of ["bankAccountId", "status", "cursor", "limit"] as const) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) params.set(name, value);
  }
  try {
    const response = await tenantApiRequest(
      `/v1/banking/transactions?${params.toString()}`,
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
      { error: "No podemos cargar los movimientos bancarios." },
      { status: 503 },
    );
  }
}
