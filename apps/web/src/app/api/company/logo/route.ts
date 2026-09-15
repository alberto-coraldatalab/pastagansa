import { NextResponse } from "next/server";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET() {
  try {
    const response = await tenantApiRequest("/v1/companies/current/logo");
    if (!response.ok)
      return NextResponse.json(
        { error: normalizeApiError(await response.json().catch(() => undefined)) },
        { status: response.status },
      );
    return new NextResponse(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/octet-stream",
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return sessionError(error);
  }
}

export async function PUT(request: Request) {
  const incoming = await request.formData().catch(() => undefined);
  const file = incoming?.get("file");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Selecciona un logo válido." }, { status: 400 });
  const body = new FormData();
  body.set("file", file, file.name);
  return mutate({ method: "PUT", body });
}

export async function DELETE() {
  return mutate({ method: "DELETE" });
}

async function mutate(init: RequestInit) {
  try {
    const response = await tenantApiRequest("/v1/companies/current/logo", init);
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    const body = await response.json().catch(() => undefined);
    if (!response.ok)
      return NextResponse.json({ error: normalizeApiError(body) }, { status: response.status });
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    return sessionError(error);
  }
}

function sessionError(error: unknown) {
  if (error instanceof SessionError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "No podemos conectar con el servicio." }, { status: 503 });
}
