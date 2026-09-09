import { NextResponse } from "next/server";
import { z } from "zod";
import { purchaseInputSchema } from "@/lib/purchases";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return NextResponse.json({ error: "Compra no válida." }, { status: 400 });
  return forward(`/v1/purchase-invoices/${id.data}`);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const [id, input] = await Promise.all([
    z.uuid().safeParseAsync((await params).id),
    purchaseInputSchema.safeParseAsync(
      await request.json().catch(() => undefined),
    ),
  ]);
  if (!id.success || !input.success)
    return NextResponse.json(
      { error: "Revisa el proveedor, número, fechas y conceptos." },
      { status: 400 },
    );
  return forward(`/v1/purchase-invoices/${id.data}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...input.data,
      dueDate: input.data.dueDate || undefined,
      notes: input.data.notes || undefined,
    }),
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
