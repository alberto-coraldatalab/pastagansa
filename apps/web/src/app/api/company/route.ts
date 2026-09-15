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
  return forward("/v1/companies/current", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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
