import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(request: NextRequest) {
  const input = z
    .object({ accountId: z.uuid(), from: z.iso.date(), to: z.iso.date() })
    .safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!input.success)
    return NextResponse.json(
      { error: "Selecciona cuenta y periodo válidos." },
      { status: 400 },
    );
  const query = new URLSearchParams(input.data);
  try {
    const response = await tenantApiRequest(
      `/v1/accounting/reports/general-ledger?${query}`,
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
      { error: "No podemos cargar el mayor." },
      { status: 503 },
    );
  }
}
