import { NextRequest, NextResponse } from "next/server";
import { bankImportInputSchema } from "@/lib/banking";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function POST(request: NextRequest) {
  const input = bankImportInputSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "Revisa el movimiento antes de importarlo." },
      { status: 400 },
    );
  try {
    const response = await tenantApiRequest("/v1/banking/transactions/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.data),
    });
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
      { error: "No podemos importar el movimiento." },
      { status: 503 },
    );
  }
}
