import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionError, tenantApiRequest } from "@/lib/server-session";
import { normalizeApiError } from "@/lib/session";

const idSchema = z.uuid();

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ error: "Sesión no válida." }, { status: 400 });
  try {
    const response = await tenantApiRequest(
      `/v1/identity/sessions/${encodeURIComponent(id.data)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      return NextResponse.json(
        { error: normalizeApiError(body) },
        { status: response.status },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof SessionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "El servicio no está disponible." },
      { status: 503 },
    );
  }
}
