import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const inputSchema = z.object({ template: z.enum(["DUE_SOON", "OVERDUE_FIRST", "OVERDUE_SECOND"]), idempotencyKey: z.string().trim().min(1).max(128) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [id, input] = await Promise.all([z.uuid().safeParseAsync((await params).id), inputSchema.safeParseAsync(await request.json().catch(() => undefined))]);
  if (!id.success || !input.success) return NextResponse.json({ error: "Revisa el recordatorio." }, { status: 400 });
  const { idempotencyKey, ...body } = input.data;
  return forward(`/v1/invoices/${id.data}/payment-reminder`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(body) });
}

async function forward(path: string, init: RequestInit) {
  try {
    const response = await tenantApiRequest(path, init);
    const body = await response.json().catch(() => undefined);
    if (!response.ok) return NextResponse.json({ error: normalizeApiError(body) }, { status: response.status });
    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No podemos enviar el recordatorio." }, { status: 503 });
  }
}
