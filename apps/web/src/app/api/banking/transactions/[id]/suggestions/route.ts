import { NextRequest, NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const windowDays = request.nextUrl.searchParams.get("windowDays") ?? "7";
  try {
    const response = await tenantApiRequest(
      `/v1/banking/transactions/${encodeURIComponent(id)}/suggestions?windowDays=${encodeURIComponent(windowDays)}`,
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
      { error: "No podemos buscar coincidencias." },
      { status: 503 },
    );
  }
}
