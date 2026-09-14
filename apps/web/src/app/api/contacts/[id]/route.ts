import { NextResponse } from "next/server";
import { z } from "zod";
import { contactInputSchema } from "@/lib/contacts";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const idSchema = z.uuid();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = idSchema.safeParse((await params).id);
  const input = contactInputSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!id.success || !input.success)
    return NextResponse.json(
      { error: "Revisa los datos del contacto antes de guardarlo." },
      { status: 400 },
    );
  try {
    const response = await tenantApiRequest(
      `/v1/contacts/${encodeURIComponent(id.data)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.data),
      },
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
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ error: "Contacto no válido." }, { status: 400 });
  try {
    const response = await tenantApiRequest(
      `/v1/contacts/${encodeURIComponent(id.data)}`,
      { method: "DELETE" },
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
      { error: "No podemos conectar con el servicio." },
      { status: 503 },
    );
  }
}
