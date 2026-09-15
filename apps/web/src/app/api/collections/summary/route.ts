import { NextRequest, NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(request: NextRequest) {
  return forward("/v1/collections/summary", request.nextUrl.searchParams);
}

async function forward(path: string, source: URLSearchParams) {
  const params = new URLSearchParams();
  for (const name of ["asOf", "text"] as const) {
    const value = source.get(name);
    if (value) params.set(name, value);
  }
  try {
    const response = await tenantApiRequest(`${path}?${params}`);
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
      { error: "No podemos cargar la cartera." },
      { status: 503 },
    );
  }
}
