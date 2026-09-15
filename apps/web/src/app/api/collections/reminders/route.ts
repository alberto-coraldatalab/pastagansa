import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeApiError } from "@/lib/session";
import { SessionError, tenantApiRequest } from "@/lib/server-session";

const inputSchema = z.object({ template: z.enum(["DUE_SOON", "OVERDUE_FIRST", "OVERDUE_SECOND"]), invoiceIds: z.array(z.uuid()).min(1).max(100), idempotencyKey: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => undefined));
  if (!input.success) return NextResponse.json({ error: "Revisa las facturas seleccionadas." }, { status: 400 });
  const { idempotencyKey, ...body } = input.data;
  try {
    const response = await tenantApiRequest("/v1/collections/reminders", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => undefined);
    if (!response.ok) return NextResponse.json({ error: normalizeApiError(data) }, { status: response.status });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No podemos enviar los recordatorios." }, { status: 503 });
  }
}
