import { NextRequest, NextResponse } from "next/server";
import { contactInputSchema } from "@/lib/contacts";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const name of ["search", "cursor", "limit", "kind"] as const) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) params.set(name, value);
  }
  return forward(`/v1/contacts?${params.toString()}`);
}

export async function POST(request: Request) {
  const input = contactInputSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "Revisa los datos del cliente antes de guardarlo." },
      { status: 400 },
    );
  return forward("/v1/contacts", {
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
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}
