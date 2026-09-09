import { NextRequest, NextResponse } from "next/server";
import { bankAccountInputSchema } from "@/lib/banking";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET() {
  return forward("/v1/banking/accounts");
}

export async function POST(request: NextRequest) {
  const input = bankAccountInputSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "Revisa los datos de la cuenta bancaria." },
      { status: 400 },
    );
  return forward("/v1/banking/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.data),
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
      { error: "No podemos conectar con el servicio bancario." },
      { status: 503 },
    );
  }
}
