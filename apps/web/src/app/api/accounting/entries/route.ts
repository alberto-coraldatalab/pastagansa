import { NextRequest, NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(request: NextRequest) {
  const query = new URLSearchParams();
  for (const name of ["from", "to", "limit"] as const) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) query.set(name, value);
  }
  try {
    const response = await tenantApiRequest(
      `/v1/accounting/journal-entries?${query}`,
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
      { error: "No podemos cargar el diario." },
      { status: 503 },
    );
  }
}
