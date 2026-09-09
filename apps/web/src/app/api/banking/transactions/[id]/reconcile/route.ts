import { NextRequest, NextResponse } from "next/server";
import { reconcileInputSchema } from "@/lib/banking";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const input = reconcileInputSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!input.success)
    return NextResponse.json(
      { error: "Selecciona un apunte contable válido." },
      { status: 400 },
    );
  try {
    const response = await tenantApiRequest(
      `/v1/banking/transactions/${encodeURIComponent(id)}/reconcile`,
      {
        method: "POST",
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
      { error: "No podemos confirmar la conciliación." },
      { status: 503 },
    );
  }
}
